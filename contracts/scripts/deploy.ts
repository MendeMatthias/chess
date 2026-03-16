import { ethers, run, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying BonuzChess with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;
  const treasuryFeeBps = parseInt(process.env.TREASURY_FEE_BPS || "1000"); // 10%
  const minStake = ethers.parseEther(process.env.MIN_STAKE || "0.001");
  const maxStake = ethers.parseEther(process.env.MAX_STAKE || "10");

  const BonuzChess = await ethers.getContractFactory("BonuzChess");
  const chess = await BonuzChess.deploy(treasuryAddress, treasuryFeeBps, minStake, maxStake);
  await chess.waitForDeployment();

  const address = await chess.getAddress();
  console.log("BonuzChess deployed to:", address);

  // Authorize backend signer
  const backendSigner = process.env.BACKEND_SIGNER_ADDRESS;
  if (backendSigner) {
    const tx = await chess.setAuthorizedCaller(backendSigner, true);
    await tx.wait();
    console.log("Backend signer authorized:", backendSigner);
  }

  // Verify on block explorer
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    await new Promise(r => setTimeout(r, 30000));
    try {
      await run("verify:verify", {
        address,
        constructorArguments: [treasuryAddress, treasuryFeeBps, minStake, maxStake],
      });
      console.log("Contract verified!");
    } catch (error: any) {
      console.log("Verification failed:", error.message);
    }
  }

  console.log("\n=== Deployment Summary ===");
  console.log("Network:", network.name);
  console.log("Contract:", address);
  console.log("Treasury:", treasuryAddress);
  console.log("Fee:", treasuryFeeBps / 100, "%");
  console.log("Min Stake:", ethers.formatEther(minStake), "ETH");
  console.log("Max Stake:", ethers.formatEther(maxStake), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
