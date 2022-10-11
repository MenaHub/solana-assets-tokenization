const anchor = require("@project-serum/anchor");
const assert = require("assert");
const { LAMPORTS_PER_SOL, PublicKey, Keypair, SystemProgram } = require("@solana/web3.js");
const {
  AccountLayout,
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  getMint,
  getAccount,
} = require("@solana/spl-token");

const express = require('express')
const router = express.Router()

anchor.setProvider(anchor.Provider.env());

const program = anchor.workspace.T10NSmartcontract;

let connection = program.provider.connection

let wallet = program.provider.wallet

// hardcoded wallets
let advisorSK = [82,90,7,245,20,144,76,2,145,5,216,62,82,58,197,97,70,28,154,216,43,43,155,62,160,179,98,144,216,57,69,175,93,148,47,73,25,69,115,25,93,186,182,175,55,212,152,66,108,103,100,10,60,138,168,110,0,62,228,105,248,50,18,211]
    .slice(0,32);  // the fromSeed() method requires 32 bytes
let advisor = Keypair.fromSeed(Uint8Array.from(advisorSK));

let originatorSK = [200,103,148,114,163,222,141,19,123,104,173,149,211,238,193,161,224,31,64,182,107,248,100,157,145,2,156,10,65,217,161,254,197,172,1,102,43,206,107,229,204,115,182,84,17,97,45,148,162,223,222,14,246,175,83,250,45,240,213,90,48,252,238,96]
    .slice(0,32);  
let originator = Keypair.fromSeed(Uint8Array.from(originatorSK));

let receiverSK = [122,126,34,231,37,152,222,4,91,14,197,85,194,208,212,148,41,19,60,94,241,144,50,122,227,209,27,193,140,48,11,17,16,77,52,222,40,175,190,128,94,215,177,19,121,195,209,153,45,114,209,33,29,49,23,178,25,241,242,164,181,32,148,67]
    .slice(0,32); 
let receiver = Keypair.fromSeed(Uint8Array.from(receiverSK));

router.get('/mint', async (req, res) => {

    // airdropping 100 solana tokens if its balance is below 10
    if(await getAccountBalance(advisor) < 10){
        await airdropAccount(advisor)
    }
    if(await getAccountBalance(originator) < 10){
        await airdropAccount(originator)
    }
    if(await getAccountBalance(receiver) < 10){
        await airdropAccount(receiver)
    }

    let originatorBalanceBeforeBuilding = await getAccountBalance(originator)
    let walletBalanceBeforeBuilding = await getAccountBalance(wallet)

    // create the mint account that represents a token
    let mint = await createMintAccount(originator, advisor)

    // create the token account for the originator to receive the tokens identified by "mint"
    let originator_ata = await associetedTokenAccount(originator, mint)
    //console.log(`\nOriginator ATA token's amount before mint: ${(await connection.getTokenAccountBalance(originator_ata.address)).value.amount}`)

    let newBuilding = Keypair.generate() // generate the pubkey for the new building account

    // parse data coming from the request
    let total_supply = new anchor.BN(parseInt(req.query.supply)*10**6) 
    let token_to_sell = new anchor.BN(parseInt(req.query.sell)*10**6) 
    let token_value = new anchor.BN(parseInt(req.query.value)*10**6) 

    var startTime = new Date();

    // create the building account
    await program.rpc.createBuilding(
      total_supply,
      token_to_sell,
      token_value,
      false,
      {
      accounts: {
        building: newBuilding.publicKey,
        advisor: advisor.publicKey, 
        originator: originator.publicKey,
        systemProgram: SystemProgram.programId, // solana's official system'
      },
      signers: [newBuilding, advisor], // I need to pass in the account just created and the signer of the transaction
    });

    // mint tokens to originator ATA
    await program.rpc.mintToken(
        mint,
        {
        accounts: {
            building: newBuilding.publicKey,
            mint: mint,
            mintAuthority: advisor.publicKey,
            receiverTokenAccount: originator_ata.address,
            tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [advisor],
    });

    var endTime = new Date(); 
    var timeElapsed = endTime.getTime() - startTime.getTime()

    console.log("Building's publickey: " + newBuilding.publicKey)

    // Here is after sending the transaction to the blockchain
    // Fetch the account details of the created new building
    const newBuildingAccount = await program.account.building.fetch(newBuilding.publicKey)

    assert.strictEqual(newBuildingAccount.advisor.toBase58(), advisor.publicKey.toBase58())
    assert.strictEqual(newBuildingAccount.originator.toBase58(), originator.publicKey.toBase58())
    assert.strictEqual(newBuildingAccount.totalSupply.toNumber(), 10000e6)
    assert.strictEqual(newBuildingAccount.tokenToSell.toNumber(), 4000e6)
    assert.equal(newBuildingAccount.token.toBase58(), mint.toBase58())

    console.log("Originator ata: "+ originator_ata.address)
    //console.log(`Originator ATA token's amount after mint: ${(await connection.getTokenAccountBalance(originator_ata.address)).value.amount}`)

    let walletBalanceAfterMint = await getAccountBalance(wallet)
    let walletCost = (walletBalanceBeforeBuilding - walletBalanceAfterMint)/(10**9)
    //console.log("total cost wallet " + totalCost)

    let originatorBalanceAfterMint = await getAccountBalance(originator)
    let originatorCost = (originatorBalanceBeforeBuilding-originatorBalanceAfterMint)/(10**9)
    //console.log('total originator cost '+ originatorCost)

    let generalCost = (originatorCost + walletCost)    
    console.log(`general cost ${generalCost} sol`) 
    console.log("Solana token emitted in " + timeElapsed + " ms")

    res.json({"token":mint, "building":newBuilding.publicKey, "totalCost":generalCost, "timeElapsed":timeElapsed})
})

router.get('/transfer', async (req, res) => {

    let mint = new PublicKey(req.query.token)
    //console.log("\n" + mint.toBase58())

    originator_ata = await associetedTokenAccount(originator, mint)
    //console.log(`\nOriginator ATA token's amount before transfer: ${(await connection.getTokenAccountBalance(originator_ata.address)).value.amount}`)

    receiver_ata = await associetedTokenAccount(receiver, mint)
    //console.log(`Receiver ATA token's amount before transfer: ${(await connection.getTokenAccountBalance(receiver_ata.address)).value.amount}`)

/*     let originator_ata_token_amount = await connection.getTokenAccountBalance(originator_ata.address);
    console.log(`\nOriginator ATA token's amount before transfer: ${originator_ata_token_amount.value.amount}`)
    let receiver_ata_token_amount = await connection.getTokenAccountBalance(receiver_ata.address)
    console.log(`Receiver ATA token's amount before transfer: ${receiver_ata_token_amount.value.amount}`)
 */
    let amount = new anchor.BN(parseInt(req.query.amount)*10**6) // 1000

    await program.rpc.transferWrapper(amount, {
        accounts: {
            sender: originator.publicKey,
            senderTokenAccount: originator_ata.address,
            receiverTokenAccount: receiver_ata.address,
            mint: mint,
            tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [originator],
    });

    //await printAssocietedTokenAccounts(originator, "Originator")
    //await printAssocietedTokenAccounts(receiver, "Receiver")

    res.send("token successfully transfered")
})

async function getAccountBalance(user){
    return await connection.getBalance(user.publicKey)
}

async function airdropAccount(user) {
    // request for airdrop to pay for originator's transactions
    const airdropSignature = await connection.requestAirdrop(
        user.publicKey,
        100*LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(airdropSignature);
}

async function createMintAccount(payer, authority) {
    // MINT ACCOUNT
    // This mint account is the token identifier, later used to mint tokens to a token account
        //and create the initial supply
    return await createMint(
        connection, // connection
        payer, // fee payer Keypair
        authority.publicKey, // mint authority publickey
        authority.publicKey, // freeze authority publickey (you can use `null` to disable it. when you disable it, you can't turn it on again)
        6 // decimals
    );

}

async function associetedTokenAccount(user, mint) {
    return await getOrCreateAssociatedTokenAccount(
        connection, // connection
        user, // fee payer
        mint, // mint
        user.publicKey // owner,
    );
}

async function printAssocietedTokenAccounts(user, role) {
    const associatedTokenAccounts = await connection.getTokenAccountsByOwner(
        user.publicKey,
        { programId: TOKEN_PROGRAM_ID }
    );

    console.log(`\n${role}'s owned tokens`)
    console.log("Token                                         Balance");
    console.log("------------------------------------------------------------");

    // to get all the token accounts of an owner
    associatedTokenAccounts.value.forEach((e) => {
        const accountInfo = AccountLayout.decode(e.account.data);
        console.log(`${new PublicKey(accountInfo.mint)}   ${accountInfo.amount}`);
    })
}

// always make sure to put static methods before dynamic ones as calls are made top to bottom

module.exports = router
    // exporting the module as a router so that we can use it in our server.js file