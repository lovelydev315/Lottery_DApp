import React, {useState, useEffect} from "react"
import './App.css';
import Web3 from 'web3';
import {lotteryAbi, tokenAbi} from "./abi";

const tokenAddress = "0xB6C811DFA352c7D0A3DA8a1bA967fB32D1D60B5c";
const lotteryAddress = "0x9d70b74633f112e45691EF817D24A07860e9aa4E";
let timeCounter;

function App() {
  const [ticket, setTicket] = useState("");
  const [account, setAccount] = useState(undefined);
  const [lotteryContract, setLotteryContract] = useState(undefined);
  const [tokenContract, setTokenContract] = useState(undefined);
  const [ticketValue, setTicketValue] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [timeState, setTimeState] = useState("");
  const [pending, setPending] = useState(false);
  const [withdrawPending, setWithdrawPending] = useState(false);
  const [winners, setWinners] = useState([]);
  const [owner, setOwner] = useState('');
  useEffect(async()=>{
    await initFunc();
  },[])
  async function buyTicket() {
    if(pending) return;
    if(!ticket) return alert("please insert ticket input");
    setPending(true);
    let accountToken;
    await lotteryContract.methods.isInLottery().call((err, result)=>{
      if(result) {
        setPending(false);
        return alert("you are already in lottery");
      }
    })
    await tokenContract.methods.balanceOf(account).call((err, result)=> {
      accountToken = result;
    });
    if(accountToken < ticket * ticketValue) {
      setPending(false);
      return alert("not enough tokens");
    }
    let allowance = 0;
    await tokenContract.methods.allowance(account, lotteryAddress).call((err, result)=>{
      allowance = result;
      if(err) {
        return setPending(false);
      }
    })
    if(allowance < ticket * ticketValue) {
      await tokenContract.methods.approve(lotteryAddress, ticket * ticketValue - allowance).send({from: account}, (err, result)=> {
        if(err) {
          return setPending(false);
        }
      })
    } 
    await lotteryContract.methods.enter(ticket).send({from: account}, (err, result)=>{
      if(err) {
        return setPending(false);
      }
    })
    setPending(false);
    setTicket("");
  }
  async function withdraw() {
    if(withdrawPending) return;
    setWithdrawPending(true);
    let state = true;
    console.log(account)
    await lotteryContract.methods.userBonus(account).call((err, result)=> {
      if(!result || result == 0) {
        state = false;
        alert("you already got all the bonus");
        setWithdrawPending(false);
      }
    })
    if(state) {
        await lotteryContract.methods.withdraw().send({from: account},(err, result) => {
          console.log(result)
          if(result) {
            alert("You have earned "+result);
            setWithdrawPending(false);
          }
        })
    }
  }
  async function getWinner() {
    await lotteryContract.methods.pickWinner().send({from: account}, (err, result)=>{
    })
  }
  async function initFunc() {
    let web3 = new Web3(Web3.givenProvider || "https://ropsten.infura.io/v3/3587df9c45a740f9812d093074c6a505");
    let socketWeb3 = new Web3('wss://ropsten.infura.io/ws/v3/3587df9c45a740f9812d093074c6a505');

    const socketContract = await new socketWeb3.eth.Contract(lotteryAbi, lotteryAddress);

    socketContract.events.allEvents({ fromBlock: "latest" })
    .on('data', function(event){
        switch(event.event) {
          case "ticketValueChanged":
            setTicketValue(event.returnValues[0]);
            break;
          case "changeTotalTokens":
            setTotalTokens(event.returnValues[0]);
            break;
          case "lotteryEnded":
            setWinners([event.returnValues[0].toString(), event.returnValues[1].toString()]);
            alert("winners: "+event.returnValues[0].toString()+", "+event.returnValues[1].toString())
            setTotalTokens("");
            let newTime = event.returnValues[2];
            if(timeCounter) clearInterval(timeCounter);
            timeCounter = setInterval(() => {
              let now = Math.round(Date.now()/1000);
              if(!newTime) setTimeState("");
              else if(now >= Number(newTime) && now <= 604800 + Number(newTime)) {
                let delta = 604800 + Number(newTime) - now;
                if(delta >= 3600) setTimeState(Math.floor(delta / 3600)+"h "+Math.floor((delta % 3600) / 60)+"m "+ (delta % 60)+"s");
                else if(delta >= 60) setTimeState(Math.floor((delta % 3600) / 60)+"m "+ (delta % 60)+"s");
                else setTimeState(Math.floor(delta+"s"));
              }
              else {
                setTimeState("pending");
              }
            }, 1000);
        }
    })
    .on('changed', function(event){
    })
    .on('error', console.error);
  
    if (window.ethereum) {
      web3 = new Web3(window.ethereum);
      try {
        const account = await window.ethereum.enable();
        const lotteryContract = new web3.eth.Contract(lotteryAbi, lotteryAddress);
        const tokenContract = new web3.eth.Contract(tokenAbi, tokenAddress);
        setLotteryContract(lotteryContract);
        setTokenContract(tokenContract);
        setAccount(web3.utils.toChecksumAddress(account[0]));
        lotteryContract.methods.ticketValue().call((err, result)=>{
          setTicketValue(result);
        })
        lotteryContract.methods.lotteryTokens().call((err, result)=>{
          setTotalTokens(result);
        })
        lotteryContract.methods.getWinners().call((err, result)=> {
          if(!result) return;
          setWinners([result[0], result[1]]);
        })
        lotteryContract.methods.manager().call((err, result) => {
          setOwner(result);
        })
        lotteryContract.methods.startTime().call((err, result)=>{
          timeCounter = setInterval(() => {
            let now = Math.round(Date.now()/1000);
            if(!result) setTimeState("");
            else if(now >= Number(result) && now <= 604800 + Number(result)) {
              let delta = 604800 + Number(result) - now;
              if(delta >= 3600) setTimeState(Math.floor(delta / 3600)+"h "+Math.floor((delta % 3600) / 60)+"m "+ (delta % 60)+"s");
              else if(delta >= 60) setTimeState(Math.floor((delta % 3600) / 60)+"m "+ (delta % 60)+"s");
              else setTimeState(Math.floor(delta+"s"));
            }
            else {
              setTimeState("pending");
            }
          }, 1000);
        })
        window.ethereum.on('accountsChanged', function (accounts) {
          setAccount(web3.utils.toChecksumAddress(accounts[0]));
        })
      }
      catch(e) {
      }
    }
    // Legacy DApp Browsers
    else if (window.web3) {
      web3 = new Web3(window.web3.currentProvider);
    }
    // Non-DApp Browsers
    else {
      alert('You have to install MetaMask !');
    }
  }
  function checkWinningState() {
    if(winners[0] == account && winners[1] == account) return "both";
    else if(winners[0] == account) return "first";
    else if (winners[1] == account) return "second";
    else return "";
  }
  return (
    <div className="login-box">
      {owner == account ? <button style={{position: "absolute", color: "white", fontWeight: "bold", background: "transparent", top: "10px"}} onClick={getWinner}>End Lottery</button>: ""}
      <p style={{color: "red", fontStretch: "condensed", textAlign: "center"}}>{account}</p>
      <h2>Lottery</h2>
        <div className="user-box">
          <input type="text" value={ticket} onChange={e=>setTicket(e.target.value)} />
          <label>How much tickets to buy?</label>
        </div>

        <h3>Total prizepool: {totalTokens}</h3>
        <h3>For 1st winner: {Math.floor(totalTokens/3)}</h3>
        <h3>For 2nd winner: {Math.floor(totalTokens/3)}</h3>
        <h3>To burning: {totalTokens - Math.floor(totalTokens/3)*2}</h3>
        <h3>Your winnings: {checkWinningState()}</h3>

      <h2>Next lottery: in {timeState}</h2>

        <a onClick={buyTicket}>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          {pending ? "Please wait..." : "Buy ticket"}
        </a>
        <a onClick={withdraw}>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          {withdrawPending ? "Please wait..." : "Claim winnings"}
        </a>
    </div>
  );
}

export default App;
