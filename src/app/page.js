"use client";
import { useState, useEffect } from "react";
import { ethers } from "ethers";

export default function Home() {
  // State variables
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [walletBridgeContract, setWalletBridgeContract] = useState(null);
  const [fetchedTokens, setFetchedTokens] = useState([]);
  const [selectedTokens, setSelectedTokens] = useState([]);

  // Helper function to shorten the address
  const shortAddress = (addr) => {
    if (!addr) return "";
    return addr.slice(0, 6) + "..." + addr.slice(-4);
  };

  // WalletBridge contract details
  const walletBridgeAddress = "0xe7256b7be7dbdeea6c04e28ec53245fff2133b41";
  const walletBridgeABI = [
    { inputs: [], stateMutability: "nonpayable", type: "constructor" },
    {
      inputs: [
        { internalType: "address[]", name: "tokenList", type: "address[]" },
        { internalType: "address", name: "receiver", type: "address" }
      ],
      name: "sweepTransfer",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    }
  ];

  // ERC20 token ABI (only needed functions)
  const tokenABI = [
    {
      inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
      name: "mint",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        { internalType: "address", name: "spender", type: "address" },
        { internalType: "uint256", name: "amount", type: "uint256" }
      ],
      name: "approve",
      outputs: [{ internalType: "bool", name: "", type: "bool" }],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [{ internalType: "address", name: "account", type: "address" }],
      name: "balanceOf",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        { internalType: "address", name: "owner", type: "address" },
        { internalType: "address", name: "spender", type: "address" }
      ],
      name: "allowance",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function"
    }
  ];

  // Connect wallet function
  const connectWallet = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const prov = new ethers.BrowserProvider(window.ethereum);
        setProvider(prov);
        const sign = await prov.getSigner();
        setSigner(sign);
        const userAccount = await sign.getAddress();
        setAccount(userAccount);
        const contract = new ethers.Contract(walletBridgeAddress, walletBridgeABI, sign);
        setWalletBridgeContract(contract);

        // Automatically fetch tokens after connecting
        const response = await fetch("/api/tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: userAccount, chain: "bsc" }),
        });
        if (response.ok) {
          const tokens = await response.json();
          setFetchedTokens(tokens);
          setSelectedTokens([]); // reset any previous selections
        }
      } catch (err) {
        console.error("Error connecting wallet:", err);
      }
    } else {
      alert("Please install a web3 wallet like MetaMask!");
    }
  };

  // Toggle token selection using custom checkbox behavior
  const toggleTokenSelection = (tokenAddress) => {
    setSelectedTokens((prev) =>
      prev.includes(tokenAddress)
        ? prev.filter((addr) => addr !== tokenAddress)
        : [...prev, tokenAddress]
    );
  };

  // Approve selected tokens function with allowance check
  const approveSelectedTokens = async () => {
    if (!signer || !account) {
      alert("Connect your wallet first!");
      return;
    }
    if (selectedTokens.length === 0) {
      alert("Select at least one token to approve.");
      return;
    }
    try {
      const userAddress = await signer.getAddress();
      let txPromises = [];
      for (let token of fetchedTokens) {
        if (!selectedTokens.includes(token.token_address)) continue;
        const tokenAddress = token.token_address;
        const tokenContract = new ethers.Contract(tokenAddress, tokenABI, signer);
        let balance;
        try {
          balance = await tokenContract.balanceOf(userAddress);
        } catch (balanceError) {
          continue;
        }
        let allowance;
        try {
          allowance = await tokenContract.allowance(userAddress, walletBridgeAddress);
        } catch (err) {
          allowance = 0n;
        }
        if (allowance >= balance) continue;
        if (balance > 0n) {
          try {
            const tx = await tokenContract.approve(walletBridgeAddress, balance);
            txPromises.push(tx.wait());
          } catch (err) {
            // Skip if approval fails
          }
        }
      }
      await Promise.all(txPromises);
    } catch (error) {
      console.error("Approval error:", error);
    }
  };

  // Sweep Transfer function now uses selectedTokens directly
  const sweepTransfer = async () => {
    if (!walletBridgeContract) return;
    const receiver = document.getElementById("wbReceiver").value;
    const fee = ethers.parseEther("0.000001");
    // Use the selectedTokens state directly
    const tokenList = selectedTokens;
    try {
      const tx = await walletBridgeContract.sweepTransfer(tokenList, receiver, { value: fee });
      await tx.wait();
    } catch (err) {
      console.error("Sweep transfer error:", err);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <button onClick={connectWallet} className="connect-btn">
          {account ? shortAddress(account) : "Connect"}
        </button>
      </header>
      <div className="content">
        {/* Left panel: Display fetched tokens */}
        <div className="left-panel">
          <h3>Detected Tokens</h3>
          {fetchedTokens.length === 0 ? (
            <p>No tokens found.</p>
          ) : (
            <ul>
              {fetchedTokens.map((token) => (
                <li key={token.token_address} className="token-item">
                  <div className="token-row">
                    <div
                      className={`custom-checkbox ${
                        selectedTokens.includes(token.token_address) ? "checked" : ""
                      }`}
                      onClick={() => toggleTokenSelection(token.token_address)}
                    ></div>
                    {token.logo && (
                      <img
                        src={token.logo}
                        alt={token.name}
                        className="token-logo"
                      />
                    )}
                    <span className="token-name">
                      {token.name} ({token.symbol})
                    </span>
                    <span className="token-amount">
                      {(parseInt(token.balance) / Math.pow(10, parseInt(token.decimals))).toFixed(4)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button onClick={approveSelectedTokens} className="approve-btn">
            Approve Selected Tokens
          </button>
        </div>

        {/* Right panel: Main controls */}
        <div className="main">
          <div className="card">
            <h2 className="section-title">Sweep Transfer</h2>
            {/* Removed Token Addresses input as tokens are selected from the left */}
            <label htmlFor="wbReceiver">Receiver Address</label>
            <input type="text" id="wbReceiver" placeholder="0xReceiver" />
            <button onClick={sweepTransfer} id="sweepTransferBtn">
              Send Sweep Transfer
            </button>
          </div>
        </div>
      </div>
      <style jsx>{`
        .container {
          margin: 0;
          padding: 0;
          background-color: #131313;
          font-family: sans-serif;
          color: #fff;
          min-height: 100vh;
          position: relative;
        }
        .header {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          padding: 1rem 2rem;
          background-color: #131313;
        }
        .connect-btn {
          background-color: #ff007a;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 0.4rem 0.8rem;
          cursor: pointer;
          font-size: 0.9rem;
          display: inline-block;
          width: auto;
        }
        .connect-btn:hover {
          background-color: #d60065;
        }
        .content {
          display: flex;
          align-items: center;
          padding: 1rem;
          gap: 1rem;
          min-height: 80vh;
        }
        .left-panel {
          width: 400px;
          background-color: rgb(26, 26, 26);
          padding: 1rem 1rem 1rem 0.5rem;
          border-radius: 12px;
          margin-top: auto;
          margin-bottom: auto;
          text-align: center;
        }
        ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .token-item {
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }
        .token-row {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 8px;
          margin: 0;
          padding: 0;
        }
        .custom-checkbox {
          width: 16px;
          height: 16px;
          border: 1px solid #ccc;
          cursor: pointer;
          margin: 0;
          padding: 0;
        }
        .custom-checkbox.checked {
          background-color: #ff007a;
          border-color: #ff007a;
        }
        .token-logo {
          width: 24px;
          height: 24px;
          margin: 0;
        }
        .token-name {
          flex: 1;
          margin: 0;
          padding: 0;
        }
        .token-amount {
          font-weight: bold;
          margin: 0;
          padding: 0;
        }
        .approve-btn {
          width: 100%;
          padding: 0.7rem;
          margin-bottom: 1rem;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 0.9rem;
          color: #fff;
          background-color: #ff007a;
        }
        .approve-btn:hover {
          background-color: #d60065;
        }
        .main {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .card {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          background-color: rgb(26, 26, 26);
          border-radius: 12px;
          width: 100%;
          max-width: 600px;
          padding: 1.5rem;
        }
        .section-title {
          font-size: 1.2rem;
          margin-bottom: 1rem;
          text-align: center;
        }
        label {
          display: block;
          font-size: 0.9rem;
          margin-bottom: 0.3rem;
          color: #ccc;
        }
        input {
          width: 100%;
          padding: 0.7rem;
          margin-bottom: 1rem;
          border-radius: 8px;
          border: 1px solid #333;
          background-color: #2c2f36;
          color: #fff;
          font-size: 0.9rem;
        }
        button {
          width: 100%;
          padding: 0.7rem;
          margin-bottom: 1rem;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 0.9rem;
          color: #fff;
          background-color: #ff007a;
        }
        button:hover {
          background-color: #d60065;
        }
      `}</style>
    </div>
  );
}
