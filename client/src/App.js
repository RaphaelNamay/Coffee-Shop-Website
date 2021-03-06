import React, {Fragment} from 'react';
import {
  BrowserRouter as Router,
  Route,
  Switch,
} from 'react-router-dom';
import { Provider } from 'react-redux';
import {applyMiddleware, combineReducers, createStore} from "redux";
import userReducer from "./store/reducers/userReducer";
import shopReducer from "./store/reducers/shopReducer";
import {composeWithDevTools} from "redux-devtools-extension";
import thunk from "redux-thunk";
import './App.css';

import Home from "./pages/Home";
import Navigation from "./components/Navigation";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Browse from "./pages/Browse";
import Cart from "./pages/Cart";
import VerifyReset from "./pages/VerifyReset";
import OrderHistory from "./pages/OrderHistory";
import {ToastContainer, toast} from "react-toastify";
import Identify from "./pages/Identify";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminPage from "./pages/AdminPage";
import adminReducer from "./store/reducers/adminReducer";
import LoginRedirectPage from "./pages/LoginRedirectPage";
import Logout from "./pages/Logout";
import AdminOrderHistoryPage from "./pages/AdminOrderHistoryPage";

const App = () => {
  const rootReducer = combineReducers({
    user: userReducer,
    shop: shopReducer,
    admin: adminReducer
  });

  const store = createStore(rootReducer, composeWithDevTools(applyMiddleware(thunk)));

  toast.configure();

  return (
    <Provider store={store}>
      <Router>
        <Fragment>
          <ToastContainer className='toast-container' autoClose={1500} />
          <Navigation />
          <Route exact path="/" component={Home} />
          <Switch>
            <Route exact path="/browse" component={Browse} />
            <Route exact path="/login" component={Login} />
            <Route exact path="/signup" component={Signup} />
            <Route exact path="/cart" component={Cart} />
            <Route exact path="/history" component={OrderHistory} />
            <Route exact path="/login/identify" component={Identify} />
            <Route exact path="/login/verifyreset/:token" component={VerifyReset} />
            <Route exact path="/login/redirect/:token" component={LoginRedirectPage} />
            <Route exact path="/logout" component={Logout} />
            <Route exact path="/admin/login" component={AdminLoginPage} />
            <Route exact path="/admin" component={AdminPage} />
            <Route path="/admin/orders/" component={AdminOrderHistoryPage} />
          </Switch>
        </Fragment>
      </Router>
    </Provider>
  )
};

export default App;
