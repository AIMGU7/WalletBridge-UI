// app/api/get-tokens/route.js
export async function POST(request) {
  // Parse the incoming JSON body
  const { walletAddress, chain } = await request.json();
  console.log("API received walletAddress:", walletAddress, "chain:", chain);

  // Hardcoded API key
  const API_KEY = process.env.API_KEY;


  // Build the Moralis API URL
  const url = `https://deep-index.moralis.io/api/v2/${walletAddress}/erc20?chain=${chain}`;

  try {
    const res = await fetch(url, {
      headers: {
        "accept": "application/json",
        "X-API-Key": API_KEY,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Moralis API error:", errorText);
      return new Response(
        JSON.stringify({ error: errorText }),
        { status: res.status }
      );
    }

    // Parse the response as JSON
    const tokens = await res.json();

    // Log the returned Moralis info
    console.log("Tokens fetched from Moralis:", tokens);

    // Helper: Check if a token is suspicious
    function isTokenSuspicious(token) {
      // Filter out tokens marked as possible spam
      if (token.possible_spam === true) return true;
      
      const suspiciousKeywords = ["airdrop", "claim", "gift", "winner", "promo", "earn", "free"];
      const name = token.name?.toLowerCase() || "";
      const symbol = token.symbol?.toLowerCase() || "";
      const balance = parseInt(token.balance || "0");
      const decimals = parseInt(token.decimals || "0");
      const logo = token.logo;

      if (suspiciousKeywords.some(keyword => name.includes(keyword) || symbol.includes(keyword))) {
        return true;
      }
      if (!logo) {
        return true; // Real tokens usually have logos
      }
      if (balance === 0) {
        return true; // Skip tokens with 0 balance
      }
      if (decimals > 50 || decimals === 0) {
        return true; // Unusual decimals are a red flag
      }
      return false;
    }

    // Filter out suspicious tokens and format the result
    const legitTokens = tokens.filter(token => !isTokenSuspicious(token))
      .map(token => {
        const balance = parseInt(token.balance);
        const decimals = parseInt(token.decimals);
        const readableBalance = balance / Math.pow(10, decimals);
        return { ...token, readableBalance };
      });

    return new Response(
      JSON.stringify(legitTokens),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in API route:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}
