import React from 'react';
import PropTypes from 'prop-types';
import { Button, Card } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import HashSpan from '../HashSpan';
import LoadingIndicator from '../LoadingIndicator';

function dateForTimestamp(timestamp) {
    let date = new Date(1000 * parseInt(timestamp));
    return date.toLocaleDateString();
}

const SubmissionDetail = (props, context) => {
    if (null === props.publication) {
        return (<LoadingIndicator />);
    }

    let utils = context.drizzle.web3.utils;

    let depositString = utils.fromWei(props.submission.deposit, 'ether');
    let pubString = dateForTimestamp(props.publication.returnValues.date);

    var revelationInterface = "";
    var revealLabelAndDate = "";
    var depositLabel = "";

    if (props.revelation) {
        depositLabel = "Deposit Returned: ";

        let revelationText = utils.hexToString(props.revelation.returnValues.revelation);
        revealLabelAndDate = "Revealed: " + dateForTimestamp(props.revelation.returnValues.date);

        revelationInterface = (
            <Card className="bg-light">
                <Card.Body>
                    <big>{revelationText}</big>
                </Card.Body>
            </Card>
        );
    } else {
        depositLabel = "Deposit Locked: ";

        if (props.revealPath) {
            revelationInterface = (
                <LinkContainer to={props.revealPath}>
                    <Button>Reveal This Prediction</Button>
                </LinkContainer>
            );
        }
    }

    return (
        <Card>
            <Card.Header>
                <HashSpan hash={props.submission.hash} />
            </Card.Header>
            <Card.Body>
                <Card.Text>
                    Published: {pubString}<br />
                    {depositLabel}{depositString} ETH<br />
                    {revealLabelAndDate}
                </Card.Text>
                {revelationInterface}
            </Card.Body>
        </Card>
    );
}

SubmissionDetail.propTypes = {
    submission: PropTypes.object.isRequired,
    publication: PropTypes.object,
    revealPath: PropTypes.string,
    revelation: PropTypes.object,
}

SubmissionDetail.contextTypes = {
    drizzle: PropTypes.object,
}

export default SubmissionDetail
