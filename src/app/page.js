"use client";
import Head from "next/head";
import { useState } from "react";
import { ethers } from "ethers";

export default function Home() {
  // State variables
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [walletBridgeContract, setWalletBridgeContract] = useState(null);
  const [fetchedTokens, setFetchedTokens] = useState([]);
  const [selectedTokens, setSelectedTokens] = useState([]);

  // New state for chain selection
  const [currentChain, setCurrentChain] = useState("ARB");
  const [chainDropdownOpen, setChainDropdownOpen] = useState(false);
  const availableChains = ["ARB", "BSC", "BASE"];

  // Mapping chain names to logos (download these into /public/logos)
  const chainLogos = {
    ARB: "/logos/arb.png",
    BSC: "/logos/bsc.png",
    BASE: "/logos/base.png",
  };

  // Mapping for API chain parameter values
  const chainMapping = {
    ARB: "arbitrum",
    BSC: "bsc",
    BASE: "base",
  };

  // Mapping for wallet chain switching parameters (chainId in hex)
  const chainParams = {
    ARB: { chainId: "0xa4b1" },
    BSC: { chainId: "0x38" },
    BASE: { chainId: "0x2105" },
  };

  // Mapping for WalletBridge contract addresses
  const walletBridgeAddresses = {
    ARB: "0x977F07Bd98a28d248881fb1C12C754dcA972cB45",
    BSC: "0xf3f02ad6ee6cC81C771daA079003ef1B46ca47A2",
    BASE: "0xf3f02ad6ee6cC81C771daA079003ef1B46ca47A2",
  };

  // WalletBridge ABI remains constant
  const walletBridgeABI = [
    { inputs: [], stateMutability: "nonpayable", type: "constructor" },
    {
      inputs: [
        { internalType: "address[]", name: "tokenList", type: "address[]" },
        { internalType: "address", name: "receiver", type: "address" },
      ],
      name: "sweepTransfer",
      outputs: [],
      stateMutability: "payable",
      type: "function",
    },
  ];

  // ERC20 token ABI (only needed functions)
  const tokenABI = [
    {
      inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
      name: "mint",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "address", name: "spender", type: "address" },
        { internalType: "uint256", name: "amount", type: "uint256" },
      ],
      name: "approve",
      outputs: [{ internalType: "bool", name: "", type: "bool" }],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [{ internalType: "address", name: "account", type: "address" }],
      name: "balanceOf",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        { internalType: "address", name: "owner", type: "address" },
        { internalType: "address", name: "spender", type: "address" },
      ],
      name: "allowance",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
  ];

  // Helper function to shorten the address
  const shortAddress = (addr) => {
    if (!addr) return "";
    return addr.slice(0, 6) + "..." + addr.slice(-4);
  };

  // Function to fetch tokens using the connected account and chain mapping
  const fetchTokens = async (walletAddress, chainKey) => {
    try {
      const response = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: walletAddress,
          chain: chainMapping[chainKey],
        }),
      });
      if (response.ok) {
        const tokens = await response.json();
        setFetchedTokens(tokens);
        setSelectedTokens([]); // reset any previous selections
      }
    } catch (err) {
      console.error("Error fetching tokens:", err);
    }
  };

  // Original connectWallet function (for initial connection)
  const connectWallet = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const prov = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(prov);
        const sign = await prov.getSigner();
        setSigner(sign);
        const userAccount = await sign.getAddress();
        setAccount(userAccount);
        // Create contract instance using the address corresponding to the current chain
        const contract = new ethers.Contract(
          walletBridgeAddresses[currentChain],
          walletBridgeABI,
          sign
        );
        setWalletBridgeContract(contract);

        // Fetch tokens using the correct chain mapping
        await fetchTokens(userAccount, currentChain);
      } catch (err) {
        console.error("Error connecting wallet:", err);
      }
    } else {
      alert("Please install a web3 wallet like MetaMask!");
    }
  };

  // New helper to connect using a specific chain
  const connectWalletForChain = async (chain) => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const prov = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(prov);
        const sign = await prov.getSigner();
        setSigner(sign);
        const userAccount = await sign.getAddress();
        setAccount(userAccount);
        // Use the walletBridge address for the provided chain
        const contract = new ethers.Contract(
          walletBridgeAddresses[chain],
          walletBridgeABI,
          sign
        );
        setWalletBridgeContract(contract);
        // Fetch tokens using the provided chain mapping
        await fetchTokens(userAccount, chain);
      } catch (err) {
        console.error("Error connecting wallet for chain:", err);
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
          allowance = await tokenContract.allowance(
            userAddress,
            walletBridgeAddresses[currentChain]
          );
        } catch (err) {
          allowance = 0n;
        }
        if (allowance >= balance) continue;
        if (balance > 0n) {
          try {
            const tx = await tokenContract.approve(
              walletBridgeAddresses[currentChain],
              balance
            );
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
    const fee = ethers.utils.parseEther("0.001");
    try {
      const tx = await walletBridgeContract.sweepTransfer(
        selectedTokens,
        receiver,
        { value: fee }
      );
      await tx.wait();
    } catch (err) {
      console.error("Sweep transfer error:", err);
    }
  };

  // New handlers for chain dropdown and automatic chain switching
  const toggleChainDropdown = () => {
    setChainDropdownOpen(!chainDropdownOpen);
  };

  const selectChain = async (chain) => {
    // Attempt to switch the wallet's chain
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: chainParams[chain].chainId }],
        });
      } catch (switchError) {
        console.error("Error switching chain:", switchError);
      }
    }
    // Update the current chain and close the dropdown
    setCurrentChain(chain);
    setChainDropdownOpen(false);
    // Reinitialize the connection for the selected chain so that the signer is updated.
    await connectWalletForChain(chain);
  };

  return (
    <>
      <Head>
        <title>WalletBridge</title>
        <link rel="icon" href="/logos/favicon.png" />
      </Head>
      <div className="container">
        <header className="header">
          <div className="header-left">
            <h1 className="app-title">WalletBridge</h1>
          </div>
          <div className="header-right">
            <div className="chain-dropdown-container">
              <button onClick={toggleChainDropdown} className="chain-btn">
                <img
                  src={chainLogos[currentChain]}
                  alt={currentChain}
                  className="chain-logo"
                />
              </button>
              {chainDropdownOpen && (
                <div className="chain-dropdown">
                  {availableChains.map((chain) => (
                    <div
                      key={chain}
                      className="chain-item"
                      onClick={() => selectChain(chain)}
                    >
                      <img
                        src={chainLogos[chain]}
                        alt={chain}
                        className="chain-logo"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={connectWallet} className="connect-btn">
              {account ? shortAddress(account) : "Connect"}
            </button>
          </div>
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
                          selectedTokens.includes(token.token_address)
                            ? "checked"
                            : ""
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
                    </div>
                    <span className="token-amount">
                      {(
                        parseInt(token.balance) /
                        Math.pow(10, parseInt(token.decimals))
                      ).toFixed(4)}
                    </span>
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
              <h2 className="section-title">Transfer</h2>
              <label htmlFor="wbReceiver">Receiver Address</label>
              <input type="text" id="wbReceiver" placeholder="0xReceiver" />
              <button onClick={sweepTransfer} id="sweepTransferBtn">
                Send Sweep Transfer
              </button>
            </div>
          </div>
        </div>
        <footer className="footer">
          <div className="footer-logos">
            <a
              href="YOUR_TWITTER_URL"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="/logos/x.png"
                alt="Twitter"
                className="footer-logo"
              />
            </a>
            <a
              href="YOUR_GITHUB_URL"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="/logos/github.png"
                alt="GitHub"
                className="footer-logo"
              />
            </a>
            <a
              href="https://walletbridge.gitbook.io/walletbridge"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="/logos/gitbook.png"
                alt="Docs"
                className="footer-logo"
              />
            </a>
          </div>
        </footer>
        <style jsx>{`
          .container {
            font-family: 'Roboto', sans-serif;
            color: #fff;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            max-width: 1200px;
            margin: 0 auto;
            padding: 1rem;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 0;
            border-bottom: 1px solid #333;
          }
          .header-left {
            flex: 1;
          }
          .header-right {
            display: flex;
            align-items: center;
            gap: 1rem;
          }
          .app-title {
            margin: 0;
            font-size: 1.8rem;
            color: #fff;
          }
          .chain-dropdown-container {
            position: relative;
          }
          .chain-btn {
            background-color: #ff007a;
            border: none;
            border-radius: 8px;
            padding: 0.5rem;
            display: flex;
            align-items: center;
            cursor: pointer;
            transition: background 0.3s;
          }
          .chain-btn:hover {
            background-color: #d60065;
          }
          .chain-logo {
            width: 24px;
            height: 24px;
          }
          .chain-dropdown {
            position: absolute;
            top: 110%; /* or calc(100% + 0.5rem) if you want a small gap */
            left: 50%;
            transform: translateX(-50%);
            background-color: #1f1f1f;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 0.5rem;
            z-index: 10;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
          }
          .chain-item {
            display: flex;
            align-items: center;
            padding: 0.5rem;
            cursor: pointer;
            border-radius: 6px;
            transition: background 0.3s;
          }
          .chain-item:hover {
            background-color: #ff007a;
          }
          .connect-btn {
            background-color: #ff007a;
            border: none;
            border-radius: 8px;
            padding: 0.6rem 1rem;
            font-size: 1rem;
            cursor: pointer;
            transition: background 0.3s;
          }
          .connect-btn:hover {
            background-color: #d60065;
          }
          .content {
            flex: 1;
            display: flex;
            gap: 2rem;
            margin: 2rem 0;
            flex-wrap: wrap;
          }
          .left-panel {
            background-color: #1f1f1f;
            border-radius: 12px;
            padding: 1.5rem;
            flex: 0 0 320px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
          }
          .left-panel h3 {
            margin-bottom: 1rem;
            text-align: center;
          }
          .left-panel ul {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          .token-item {
            margin-bottom: 1rem;
            padding: 0.5rem;
            background-color: #2c2c2c;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .token-row {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex: 1;
          }
          .custom-checkbox {
            width: 18px;
            height: 18px;
            border: 1px solid #ccc;
            cursor: pointer;
            border-radius: 4px;
            transition: background 0.3s;
          }
          .custom-checkbox.checked {
            background-color: #ff007a;
            border-color: #ff007a;
          }
          .token-logo {
            width: 28px;
            height: 28px;
          }
          .token-name {
            flex: 1;
            font-size: 0.9rem;
          }
          .token-amount {
            font-weight: bold;
            font-size: 0.9rem;
          }
          .approve-btn {
            width: 100%;
            padding: 0.8rem;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-size: 1rem;
            background-color: #ff007a;
            transition: background 0.3s;
            margin-top: 1rem;
          }
          .approve-btn:hover {
            background-color: #d60065;
          }
          .main {
            flex: 1;
            margin-top: 13rem; /* Increase if you want it lower */
            background-color: #1f1f1f;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
            display: flex;
            height: 300px; 
            flex-direction: column;
            justify-content: center;
            align-items: center;
            min-width: 300px;
          }
          .card {
            width: 100%;
          }
          .section-title {
            font-size: 1.4rem;
            margin-bottom: 1rem;
            text-align: center;
          }
          label {
            display: block;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
            color: #ccc;
          }
          input {
            width: 100%;
            padding: 0.8rem;
            border-radius: 8px;
            border: 1px solid #333;
            background-color: #2c2f36;
            color: #fff;
            font-size: 1rem;
            margin-bottom: 1rem;
          }
          button {
            width: 100%;
            padding: 0.8rem;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-size: 1rem;
            background-color: #ff007a;
            transition: background 0.3s;
          }
          button:hover {
            background-color: #d60065;
          }
          .footer {
            text-align: center;
            padding: 1rem 0;
            border-top: 1px solid #333;
          }
          .footer-line {
            border: none;
            height: 1px;
            background-color: #444;
            margin: 0 auto 1rem;
            max-width: 90%;
          }
          .footer-logos {
            display: flex;
            justify-content: center;
            gap: 1rem;
            margin-top: 1rem;
          }
          .footer-logo {
            width: 28px;
            height: 28px;
          }
        `}</style>
      </div>
    </>
  );
}
