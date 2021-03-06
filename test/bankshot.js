const Bankshot = artifacts.require("Bankshot");
const utils = web3.utils;
const BN = utils.BN;

async function assertRevert(txPromise, expectedReason, failureMessage) {
  var reverted = false;
  var reason = "";

  try {
    await txPromise;
  } catch (error) {
    reverted = true;
    reason = error.reason;
  }

  assert(reverted, failureMessage);
  assert.equal(expectedReason, reason, "WRONG REASON: " + failureMessage);
}

function addWeiStrings(...weiStrings) {
  return weiStrings
          .map( ws => new BN(ws) )
          .reduce( (acc, curr) => acc.add(curr) );
}

async function getGasCost(receipt) {
  let gasUsed = new BN(receipt.cumulativeGasUsed);

  let tx = await web3.eth.getTransaction(receipt.transactionHash);
  let gasPrice = new BN(tx.gasPrice);

  return gasPrice.mul(gasUsed);
}

String.prototype.toBN = function() {
  return new BN(this.toString());
}

contract("Bankshot", accounts => {

  var bankshotInstance;
  let ownerAddr = accounts[0];
  let user1Addr = accounts[1];
  let user2Addr = accounts[2];
  let user3Addr = accounts[3];
  let initVig = utils.toWei('0.01', 'ether');
  let initMinEthDeposit = utils.toWei('.03', 'ether');
  let newVig = utils.toWei('0.02', 'ether');
  let newMinEthDeposit = utils.toWei('0.05', 'ether');
  let newMaxEthDeposit = utils.toWei('2.0', 'ether');
  let extraDeposit = utils.toWei('1', 'ether');


  it("should deploy", async () => {
    bankshotInstance = await Bankshot.new(initVig, initMinEthDeposit, { from: ownerAddr, });
    assert(bankshotInstance.address.startsWith("0x"), "Deployed contract address not found");
  });

  it("should have an owner property initialized to the deployer", async () => {
    let callResult = await bankshotInstance.owner();
    assert.equal(callResult, ownerAddr, "Unexpected contract owner");
  });

  it("should have the ethereum vig set to the constructor param", async () => {
    let callResult = await bankshotInstance.ethVig();
    assert.equal(callResult, initVig, "Failed to set initial ETH vig");
  });

  it("should have the ethereum min deposit set to the constructor param", async() => {
    let callResult = await bankshotInstance.minEthDeposit();
    assert.equal(callResult, initMinEthDeposit, "Failed to set initial ETH deposit");
  });

  it("should properly calculate the minimum payable ETH", async() => {
    let callResult = await bankshotInstance.minEthPayable();

    let vig = new BN(initVig);
    let deposit = new BN(initMinEthDeposit);
    let expectedValue = vig.add(deposit);

    assert.equal(callResult.toString(10), expectedValue.toString(10), "Failed to calculate expected ETH payable");
  });

  it("should let the owner update the eth vig", async () => {
    await bankshotInstance.setEthVig(newVig, {from: ownerAddr});
    let vigResult = await bankshotInstance.ethVig();

    assert.equal(newVig.toString(10), vigResult.toString(10), "Failed to update the ETH vig");
  });

  it("should not let a non-owner update the eth vig", async () => {
    let vig = utils.toWei('1000', 'ether');
    let txPromise =  bankshotInstance.setEthVig(vig, {from: accounts[1]});

    await assertRevert(txPromise, "ONLY_OWNER", "Failed to revert non-owner vig update");
  });

  it("should let the owner update the min eth deposit", async() => {
    await bankshotInstance.setMinEthDeposit(newMinEthDeposit, {from: ownerAddr});
    let minResult = await bankshotInstance.minEthDeposit();

    assert.equal(newMinEthDeposit.toString(10), minResult.toString(10), "Failed to update the min ETH deposit");
  });

  it("should not let a non-owner update the eth min deposit", async () => {
    let deposit = utils.toWei('0', 'ether');
    let txPromise = bankshotInstance.setMinEthDeposit(deposit, {from: accounts[2]});

    await assertRevert(txPromise, "ONLY_OWNER", "Failed to revert non-owner min eth deposit update");
  });

  it("should not let a non-owner update the eth min deposit", async () => {
    let deposit = utils.toWei('100', 'ether');
    let txPromise = bankshotInstance.setMaxEthDeposit(deposit, {from: accounts[2]});

    await assertRevert(txPromise, "ONLY_OWNER", "Failed to revert non-owner max eth deposit update");
  });

  it("should calculate the updated minimum payaple ETH", async () => {
    let callResult = await bankshotInstance.minEthPayable();

    let vig = new BN(newVig);
    let deposit = new BN(newMinEthDeposit);
    let expectedValue = vig.add(deposit);

    assert.equal(expectedValue.toString(10), callResult.toString(10), "Failed to calculate updated min payable ETH");
  });

  it("should let a user submit a hash with min payment", async () => {
    let string = "Hello World";
    let hash = utils.soliditySha3({type: 'string', value: string});
    let txValue = addWeiStrings(newVig, newMinEthDeposit);

    await bankshotInstance.submitHash(hash, {from: user1Addr, value: txValue});

    let {hashes, deposits} = await bankshotInstance.submissionsForAddress(user1Addr);

    assert.equal(hashes.length, 1, "Unexpected hash count for user");
    assert.equal(hashes[0], hash, "Submitted hash not included in results");

    assert.equal(deposits.length, 1, "Unexpected deposit count for user");
    assert.equal(deposits[0].toString(10), newMinEthDeposit, "");
  });

  it("should broadcast an event for the first submission", async () => {
    let events = await bankshotInstance.getPastEvents('Publication', {filter: {user: user1Addr, subID: 0}, fromBlock: 0, toBlock: 'latest'});
    assert.equal(events.length, 1, "Didn't find submission event, or found too many");
  });

  it("should not let a user submit a deposit above the max", async () => {
    let string = "Hello Too Big";
    let hash = utils.soliditySha3({type: 'string', value: string});
    let overPay = utils.toWei('1.01', 'ether');
    let txValue = addWeiStrings(newVig, overPay);

    let txPromise = bankshotInstance.submitHash(hash, {from: user3Addr, value: txValue});

    await assertRevert(txPromise, 'OVERSIZE_DEPOSIT', "Failed to revert submission with oversized deposit");
  });

  it("should let the owner update the max deposit", async () => {
    await bankshotInstance.setMaxEthDeposit(newMaxEthDeposit, {from: ownerAddr});
    let maxResult = await bankshotInstance.maxEthDeposit();

    assert.equal(newMaxEthDeposit.toString(10), maxResult.toString(10), "Failed to update the max ETH deposit");
  });

  it("should let a user submit after the max deposit is raised", async () => {
    let string = "Hello Too Big";
    let hash = utils.soliditySha3({type: 'string', value: string});
    let overPay = utils.toWei('1.01', 'ether');
    let txValue = addWeiStrings(newVig, overPay);

    await bankshotInstance.submitHash(hash, {from: user3Addr, value: txValue});

    let {hashes, deposits} = await bankshotInstance.submissionsForAddress(user3Addr);

    assert.equal(hashes.length, 1, "Unexpected hash count for user");
    assert.equal(hashes[0], hash, "Submitted hash not included in results");

    assert.equal(deposits.length, 1, "Unexpected deposit count for user");
    assert.equal(deposits[0].toString(10), overPay, "");
  });

  it("should let another user submit a hash with above min payment", async () => {
    let string = "Hello, Cruel World";
    let hash = utils.soliditySha3({type: 'string', value: string});
    let txValue = addWeiStrings(newVig, extraDeposit);

    await bankshotInstance.submitHash(hash, {from: user2Addr, value: txValue});

    let {hashes, deposits} = await bankshotInstance.submissionsForAddress(user2Addr);

    assert.equal(hashes.length, 1, "Unexpected hash count for user");
    assert.equal(hashes[0], hash, "Submitted hash not included in results");

    assert.equal(deposits.length, 1, "Unexpected deposit count for user");
    assert.equal(deposits[0].toString(10), extraDeposit, "");
  });

  it("should broadcast an event for another user's submission", async () => {
    let events = await bankshotInstance.getPastEvents('Publication', {filter: {user: user2Addr, subID: 0}, fromBlock: 0, toBlock: 'latest'});
    assert.equal(events.length, 1, "Didn't find submission event, or found too many");
  });

  it("should not let a user submit without a payment", async () => {
    let string = "Something to hash";
    let hash = utils.soliditySha3({type: 'string', value: string});

    let txPromise = bankshotInstance.submitHash(hash, {from: user2Addr});

    await assertRevert(txPromise, 'INSUFFICIENT_FUNDS', "Failed to revert non-paying submission");
  });

  it("should not let a user submit with less than minimum payment", async () => {
    let string = "Something to hash";
    let hash = utils.soliditySha3({type: 'string', value: string});
    let txValue = addWeiStrings(newMinEthDeposit);

    let txPromise = bankshotInstance.submitHash(hash, {from: user2Addr, value: txValue});

    await assertRevert(txPromise, 'INSUFFICIENT_FUNDS', "Failed to revert submission w/ insufficient payment");
  });

  it("should not let a user claim a reveal if the string is incorrect", async () => {
    let string = "Hello Again";
    let hash = utils.soliditySha3({type: 'string', value: string});
    let txValue = addWeiStrings(newVig, newMinEthDeposit);

    await bankshotInstance.submitHash(hash, {from: user1Addr, value: txValue});
    let {hashes, deposits} = await bankshotInstance.submissionsForAddress(user1Addr);

    assert.equal(hashes.length, 2, "Unexpected hash count for user");
    assert.equal(hashes[1], hash, "Submitted hash not included in results");

    assert.equal(deposits.length, 2, "Unexpected deposit count for user");
    assert.equal(deposits[1].toString(10), newMinEthDeposit, "");

    let wrongRevealTx = bankshotInstance.revealSubmission(1, utils.toHex(string + "!!"), {from: user1Addr});
    await assertRevert(wrongRevealTx, "INVALID_REVEAL", "Revealed when it shouldn't have");
  });

  it("should broadcast a publication event for a user's second submission", async () => {
    let events = await bankshotInstance.getPastEvents('Publication', {filter: {user: user1Addr, subID: 1}, fromBlock: 0, toBlock: 'latest'});
    assert.equal(events.length, 1, "Didn't find submission event, or found too many");
  });

  it("should not show a revelation for a submission that hasn't been revealed", async () => {
    let events = await bankshotInstance.getPastEvents('Revelation', {filter: {user: user2Addr, subID: 0}});
    assert(events.length === 0, "Returned a revelation event for an unrevealed submission");
  });

  it("should not allow a non-owner to lock submission", async () => {
    let txPromise =  bankshotInstance.lockSubmissions({from: user1Addr});

    await assertRevert(txPromise, "ONLY_OWNER", "Failed to revert non-owner submissions lock");
  });

  it("should allow the owner to lock submissions", async () => {
    await bankshotInstance.lockSubmissions({from: ownerAddr});
    let isLockedResult = await bankshotInstance.areSubmissionsLocked();

    assert(isLockedResult, "Failed to lock submissions");
  });

  it("should not let a user submit after lock", async () => {
    let string = "Something to hash";
    let hash = utils.soliditySha3({type: 'string', value: string});
    let txValue = addWeiStrings(newVig, newMinEthDeposit);

    let txPromise = bankshotInstance.submitHash(hash, {from: user2Addr, value: txValue});

    await assertRevert(txPromise, 'SUBS_LOCKED', "Failed to revert submission after lock");
  });

  it("should pay a user back for a correct revelation", async () => {
    let string = "Hello Again";
    let initBalance = ( await web3.eth.getBalance(user1Addr) ).toBN();

    let result = await bankshotInstance.revealSubmission(1, utils.toHex(string), {from: user1Addr});
    let gasCost = await getGasCost(result.receipt);

    let postBalance = ( await web3.eth.getBalance(user1Addr) ).toBN();
    let amountReturned = postBalance.add(gasCost).sub(initBalance);

    assert.equal(newMinEthDeposit, amountReturned.toString(10), "Failed to return a user's minimum deposit");
  });

  it("should return the reveal string for a previously revealed submission", async () => {
    let expectedString = "Hello Again";

    let events = await bankshotInstance.getPastEvents('Revelation', {filter: {user: user1Addr, subID: 1}});
    assert(events.length === 1, "Didn't find revelation event, or found too many");

    let revelationBytes = await events[0].returnValues['revelation'];
    let revelationString = utils.hexToUtf8(revelationBytes);

    assert.equal(revelationString, expectedString, "Failed to return the revelation string");
  });

  it("should not allow a user to reveal a submission twice", async () => {
    let string = "Hello Again";

    let revealTx = bankshotInstance.revealSubmission(1, utils.toHex(string), {from: user1Addr});

    await assertRevert(revealTx, "ALREADY_REVEALED", "Allowed the user to reveal the same submission twice");
  });

  it("should pay back a user who deposited more than the minimum the correct amount", async () => {
    let string = "Hello, Cruel World";

    let initBalance = ( await web3.eth.getBalance(user2Addr) ).toBN();

    let result = await bankshotInstance.revealSubmission(0, utils.toHex(string), {from: user2Addr});
    let gasCost = await getGasCost(result.receipt);

    let postBalance = ( await web3.eth.getBalance(user2Addr) ).toBN();
    let amountReturned = postBalance.add(gasCost).sub(initBalance);

    assert.equal(extraDeposit, amountReturned.toString(10), "Failed to return a user's extra deposit");
  });

  it("should not let a non-owner withdraw the vig balance", async () => {
    let withdrawTx = bankshotInstance.withdrawVig(newVig.toBN(), {from: user2Addr});

    await assertRevert(withdrawTx, 'ONLY_OWNER', "Allowed a non-owner to withdraw the vig balance");
  });

  it("should not allow the owner to withdraw more than the vig balance", async () => {
    let withdrawAmount = utils.toWei('1', 'ether').toBN();
    let withdrawTx = bankshotInstance.withdrawVig(withdrawAmount, {from: ownerAddr});

    await assertRevert(withdrawTx, 'WITHDRAW_LIMIT', "Allowed the owner to withdraw beyond the vig balance");
  });

  it("should allow the owner to withdraw less than the total vig balance", async () => {
    let withdrawAmount = newVig.toBN();
    let initBalance = ( await web3.eth.getBalance(ownerAddr) ).toBN();

    let result =  await bankshotInstance.withdrawVig(withdrawAmount, {from: ownerAddr});
    let gasCost = await getGasCost(result.receipt);

    let postBalance = ( await web3.eth.getBalance(ownerAddr) ).toBN();
    let amountReceived = postBalance.add(gasCost).sub(initBalance);

    assert.equal(withdrawAmount.toString(10), amountReceived.toString(10), "Failed to withdraw from the vig balance");
  });

  it("should account for the previous withdrawls from the vig balance", async () => {
    let withdrawAmount = newVig.toBN().mul("4".toBN()); // The peak vig balance before previous withdraw
    let withdrawTx = bankshotInstance.withdrawVig(withdrawAmount, {from: ownerAddr});

    await assertRevert(withdrawTx, 'WITHDRAW_LIMIT', "Failed to account for previous owner vig withdraws")
  });

  it("should allow for the owner to withdraw the full vig balance", async () => {
    let withdrawAmount = newVig.toBN().mul("3".toBN());
    let initBalance = ( await web3.eth.getBalance(ownerAddr) ).toBN();

    let result =  await bankshotInstance.withdrawVig(withdrawAmount, {from: ownerAddr});
    let gasCost = await getGasCost(result.receipt);

    let postBalance = ( await web3.eth.getBalance(ownerAddr) ).toBN();
    let amountReceived = postBalance.add(gasCost).sub(initBalance);

    assert.equal(withdrawAmount.toString(10), amountReceived.toString(10), "Failed to withdraw the full vig balance");
  });
});
