const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const passport = require('passport');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());
app.use(passport.session());

// OAuth Enabling SSL
if (process.env.NODE_ENV === 'production') {
  app.all('*', function addSSL(req, res, next) {
    if (req.headers["x-forwarded-proto"] === "https" || req.url.indexOf("auth/google") !== -1) {
      return next();
    } else {
      res.redirect('https://' + req.hostname + req.url);
    }
  });
}

app.use('/api/user', require('./routes/user'));
app.use('/api/shop', require('./routes/shop'));
app.use('/api/admin', require('./routes/admin'));

/*
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '/client/build/index.html'));
});
*/

if (process.env.NODE_ENV === 'production') {
  app.use(express.static('client/build'));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '/client/build/index.html'));
  })
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Port: ${PORT}`));
