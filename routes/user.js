const express = require('express');
const { check, validationResult} = require('express-validator');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const uuid = require('uuid');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const router = express.Router();

const secrets = (process.env.NODE_ENV !== 'production') ? require("../secrets") : undefined;
const databaseConnectionString = process.env.DATABASE_URL || secrets.database;
const tokenKey = process.env.TOKEN_KEY || secrets.tokenKey;
const emailRecovery = process.env.EMAIL_RECOVERY || secrets.emailRecovery;
const passwordRecovery = process.env.PASSWORD_RECOVERY || secrets.passwordRecovery;
const resetUrl = process.env.WEBSITE_URL || secrets.resetUrl;

const pool = new Pool({
  connectionString: databaseConnectionString,
  ssl: false
});

router.post(
  "/signup",
  [
    check("firstName", "First name must not be empty")
      .not()
      .isEmpty(),
    check("lastName", "Last name must not be empty")
      .not()
      .isEmpty(),
    check("email", "Email required").isEmail(),
    check("password", "Password must be at least 5 characters").isLength({
      min: 5
    })
  ],
  async (req, res) => {
    try {
      // Check for errors in request
      if (!validationResult(req).isEmpty()) {
        // Outputting errors
        return res.status(400).json({ errors: validationResult(req).array() });
      }

      const { firstName, lastName, email, password } = req.body;

      // Check if user already exists
      const db = await pool.connect();
      const checkExistsQuery = `SELECT * FROM users WHERE email='${email}';`;
      const checkExists = await db.query(checkExistsQuery);
      const result = checkExists ? checkExists.rows : null;
      if (result.length > 0) {
        return res.status(400).json({ errors: "EMAIL_EXISTS" });
      }

      // Create the user
      const userId = uuid.v4();
      const salt = await bcrypt.genSalt(8);
      const hashedPassword = await bcrypt.hash(password, salt);

      const insertUserQuery =
        `INSERT INTO users(userId, firstName, lastName, email, password) ` +
        `VALUES ('${userId}', '${firstName}', '${lastName}', '${email}', '${hashedPassword}');`;
      await db.query(insertUserQuery);

      db.release();
      return res.status(201).send("User created");
    } catch (error) {
      return res.status(500).json({ errors: "INTERNAL_SERVER_ERROR" });
    }
  }
);

router.post(
  "/login",
  [
    check("email", "Email required").isEmail(),
    check("password", "Password required")
      .not()
      .isEmpty()
  ],
  async (req, res) => {
    try {
      // Check for errors in request
      if (!validationResult(req).isEmpty()) {
        // Outputting errors
        return res.status(400).json({ errors: validationResult(req).array() });
      }

      const { email, password } = req.body;

      // Check for valid email
      const db = await pool.connect();
      const validEmailQuery = `SELECT * FROM users WHERE email='${email}';`;
      const validEmail = await db.query(validEmailQuery);
      const result = validEmail ? validEmail.rows : null;
      if (result.length === 0) {
        return res.status(400).send({ errors: "INVALID_LOGIN" });
      }

      // Check for valid password
      const passwordResult = result[0].password;
      const passwordMatches = await bcrypt.compare(password, passwordResult);
      if (!passwordMatches) {
        return res.status(400).json({ errors: "INVALID_LOGIN" });
      }

      // Successful login
      db.release();
      jwt.sign(
        {
          userData: {
            userId: result[0].userid,
            firstName: result[0].firstname,
            lastName: result[0].lastname,
            email: result[0].email
          }
        },
        tokenKey,
        {
          expiresIn: "5h"
        },
        (error, token) => {
          return res.status(200).json({
            token: token,
            userId: result[0].userid,
            firstName: result[0].firstname,
            lastName: result[0].lastname,
            email: result[0].email
          });
        }
      );
    } catch (error) {
      return res.status(500).json({ errors: "INTERNAL_SERVER_ERROR" });
    }
  }
);

router.post("/tokenlogin", async (req, res) => {
  try {
    const { token } = req.body;

    jwt.verify(token, tokenKey, (error, tokenData) => {
      if (error) {
        return res.status(403).json({ errors: "INVALID_TOKEN" });
      } else {
        return res.status(200).json({
          userId: tokenData.userData.userId,
          firstName: tokenData.userData.firstName,
          lastName: tokenData.userData.lastName,
          email: tokenData.userData.email
        });
      }
    });
  } catch (error) {
    return res.status(500).json({ errors: "INTERNAL_SERVER_ERROR" });
  }
});

router.post('/identify', async (req, res) => {
  try {
    const {
      email
    } = req.body;

    // Check if email actually exists
    const db = await pool.connect();
    const emailExistsQuery = `SELECT * FROM users WHERE email='${email}';`;
    const emailExists = await db.query(emailExistsQuery);
    const existsResult = (emailExists) ? emailExists.rows : null;
    if (existsResult.length === 0) {
      return;
    }

    // Create one time token
    await jwt.sign(
      {
        emailData: {
          email: existsResult[0].email
        }
      },
      tokenKey,
      {
        expiresIn: '1h'
      },
      (error, token) => {
        // Once token is created, send an email
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: emailRecovery,
            pass: passwordRecovery
          }
        });

        const mailOptions = {
          from: emailRecovery,
          to: email,
          subject: 'Aroma Coffee Password Reset',
          html: `Click this link to reset your password: <a href='${resetUrl}/${token}'>Click Here</a>`
        };

        // Send email
        transporter.sendMail(mailOptions);

        // Check if user already has done a reset. If they did, edit their token
        const checkResetQuery = `SELECT * FROM resettokens WHERE email='${email}';`;
        db.query(checkResetQuery).then((checkResetResult) => {
          const hasEntry = checkResetResult.rows.length !== 0;
          if (hasEntry) {
            // Edit the token to the newest one, making all others invalid
            const editResetQuery = `UPDATE resettokens SET token='${token}' WHERE email='${email}'`;
            db.query(editResetQuery);
          } else {
            // Add an entry for reset
            const userId = existsResult[0].userid;
            const insertResetQuery = `INSERT INTO resettokens (userId, email, token) VALUES ('${userId}', '${email}', '${token}');`;
            db.query(insertResetQuery);
          }
        });
        return token;
      }
    );
    db.release();
    return res.status(200).json({ message: 'Reset email sent' });
  } catch (error) {
    return res.status(500).json({ errors: 'INTERNAL_SERVER_ERROR' });
  }
});

async function verifyResetToken(token) {
  return await jwt.verify(token, tokenKey, (error, tokenData) => {
    if (error) {
      throw new Error('INVALID_TOKEN');
    } else {
      // Check if table of tokens has this email instance
      return tokenData.emailData.email;
    }
  });
}

/**
 * This route actually does the password reset
 */
router.post('/passwordreset', async (req, res) => {
  try {
    const {
      token,
      password
    } = req.body;

    // Verify token
    const email = await verifyResetToken(token);

    // Check if this user is actually in the reset table
    const db = await pool.connect();
    const checkResetExistsQuery = `SELECT * FROM resettokens WHERE email='${email}';`;
    const checkResetExists = await db.query(checkResetExistsQuery);
    const checkResetResult = (checkResetExists) ? checkResetExists.rows : null;
    if (checkResetResult.length === 0) {
      return res.status(400).json({ errors: 'INVALID_REQUEST' });
    }

    // Check for the same token
    const tableToken = checkResetResult[0].token;
    if (tableToken !== token) {
      return res.status(403).json({ errors: 'INVALID_TOKEN' });
    }

    // Now that the tokens are equal, reset the password
    const salt = await bcrypt.genSalt(8);
    const hashedPassword = await bcrypt.hash(password, salt);
    const resetPasswordQuery = `UPDATE users SET password='${hashedPassword}' WHERE email='${email}';`;
    await db.query(resetPasswordQuery);

    const deleteResetTokensEntryQuery = `DELETE FROM resettokens WHERE email='${email}';`;
    await db.query(deleteResetTokensEntryQuery);

    db.release();
    return res.status(200).json({ message: 'PASSWORD_RESET' });
  } catch (error) {
    if (error.message === 'INVALID_TOKEN') {
      // If token is invalid then delete
      return res.status(403).json({ errors: 'INVALID_TOKEN' });
    }
    return res.status(500).json({ errors: 'INTERNAL_SERVER_ERROR' });
  }
});

module.exports = router;
