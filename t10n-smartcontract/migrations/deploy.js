// Migrations are an early feature. Currently, they're nothing more than this
// single deploy script that's invoked from the CLI, injecting a provider
// configured from the workspace's Anchor.toml.

const anchor = require("@project-serum/anchor");
const { Keypair } = require("@solana/web3.js");
const { Connection, LAMPORTS_PER_SOL } =  require("@solana/web3.js");
const path = require('path');
const spawn = require("cross-spawn");
const fs = require('fs');

module.exports = async function(provider){
  // Configure client to use the provider.
  anchor.setProvider(provider);

  // Add your deploy script here.
}
