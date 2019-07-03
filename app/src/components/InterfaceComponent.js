import React, { Component } from 'react';
import { BrowserRouter, Route, Switch } from "react-router-dom";
import SubmissionsList from './sublist/SubmissionsList';
import SubmissionFlow from './submission/SubmissionFlow';
import RevelationForm from './revelation/RevelationForm';
import NotFound from './NotFound';
import Navigation from './Navigation';
import SubmissionsContainer from './SubmissionsContainer';

class InterfaceComponent extends Component {

  constructor(props, context) {
    super(props);

    this.accounts = props.accounts;
  }

  render() {
    return (
      <BrowserRouter>
        <div className="App">
          <Navigation />
          <Switch>
            <Route path="/" render={(props) => <SubmissionsContainer {...props} component={SubmissionsList}/>} exact />
            <Route path="/:subid(\d+)/reveal" render={(props) => <SubmissionsContainer {...props} component={RevelationForm}/>} />
            <Route path="/:subid(\d+)" render={(props) => <SubmissionsContainer {...props} component={SubmissionsList}/>} />
            <Route path="/new" component={SubmissionFlow} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </BrowserRouter>
    );
  }
}

export default InterfaceComponent;
