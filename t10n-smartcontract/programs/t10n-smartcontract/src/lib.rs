use anchor_lang::prelude::*;
use std::result::Result;
use anchor_spl::{token::{self, Mint, MintTo, Token, TokenAccount, Transfer}};

declare_id!("53n8Hoi9jnhcTBgu4tVyJBT8JEJKxU2TsmHJE2ghtaQh");

    #[program]
    pub mod t10n_smartcontract {

        use super::*;

        pub fn create_building(
            ctx: Context<CreateBuilding>,
            total_supply: i128,
            token_to_sell: i64,
            token_value: i64,
            active_annuities: bool,
        ) -> Result<(), Error> {
        // CONTEXT DEFINES ALL THE ACCOUNTS THAT CAN BE PASSED INTO ONE'S PROGRAM
        // once we get into the body we have our account CreateBuilding account initialized
            // ready to go and ready to mutate
            // we also know that the advisor signed the transaction
        let building: &mut Account<Building> = &mut ctx.accounts.building; // take out the account
        let advisor: &Signer = &ctx.accounts.advisor; // got from the context
        let originator = &ctx.accounts.originator;

        // update the data in it with the inputs
        building.advisor = *advisor.key; // dereferencing it

        building.originator = *originator.key;

        require!(total_supply > 0, InvalidTokensData);
        building.total_supply = total_supply;

        require!(token_to_sell > 0 && token_to_sell <= total_supply as i64, InvalidTokensData);
        building.token_to_sell = token_to_sell;

        require!(token_value > 0, InvalidTokensData);
        building.token_value = token_value;

        building.active_annuities = active_annuities;

        Ok(())
    }

    pub fn mint_token(
        ctx: Context<MintTokens>,
        mint_account: Pubkey,
    ) -> Result<(), Error> {

        let building: &mut Account<Building> = &mut ctx.accounts.building; // take out the building account

        /* let(pda, bump_seed) = Pubkey::find_program_address(&[PDA_SEED], ctx.program_id);
        msg!("found pda:{} with bump {}", pda, bump_seed); */

        let total_supply = building.total_supply;

        building.token = mint_account;  // the token (mint account)

        token::mint_to(ctx.accounts.mint_tokens_ctx(), total_supply as u64)?;
        ctx.accounts.receiver_token_account.reload()?;
        msg!("minted tokens: {}", ctx.accounts.receiver_token_account.amount);

        Ok(())
    }

    pub fn transfer_wrapper(
        ctx: Context<TransferWrapper>,
        amount: u64, // amount of token to transfer
    ) -> Result<(), Error> {
        msg!("starting tokens: {}", ctx.accounts.sender_token_account.amount);

        require!(ctx.accounts.sender_token_account.amount > amount, InvalidTokensData);
        token::transfer(ctx.accounts.transfer_ctx(), amount)?;

        ctx.accounts.sender_token_account.reload()?;
        msg!("remaining tokens: {}", ctx.accounts.sender_token_account.amount);
        Ok(())
    }

}

//ALLOWS TO DEFINE ACCOUNTS VALIDATION LOGIC COMPLETELY SEPARATED
    // FROM THE BUSINESS LOGIC IN THE INSTRUCTION HANDLERS IN #[program]
#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub building: Account<'info, Building>,
    #[account(mut)]
    pub mint_authority: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut, has_one = mint)]
    pub receiver_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

impl<'info> MintTokens<'info> {
    fn mint_tokens_ctx(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            MintTo{
                mint: self.mint.to_account_info(),
                to: self.receiver_token_account.to_account_info(),
                authority: self.mint_authority.to_account_info(),
            }
        )
    }
}

// defining all the accounts we need for the transfer
#[derive(Accounts)]
pub struct TransferWrapper<'info>{
    pub sender: Signer<'info>, // who signs for the transfer
    #[account(mut)]
    pub sender_token_account: Account<'info, TokenAccount>, // sender ATA
    #[account(mut)]
    pub receiver_token_account: Account<'info, TokenAccount>, // receiver ATA
    pub mint: Account<'info, Mint>, // mint authority
    pub token_program: Program<'info, Token>, // allow to send Cross Program Invocation
}

// to format the above context into a Cross Program Invocation context
impl<'info> TransferWrapper<'info> {
    fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(), //token program info
            Transfer{ // setting up the accounts involved in the transfer
                from: self.sender_token_account.to_account_info(),
                to: self.receiver_token_account.to_account_info(),
                authority: self.sender.to_account_info(),
            },
        )
    }
}

#[derive(Accounts)]
pub struct CreateBuilding<'info> {
    #[account(init, payer = advisor, space = Building::LENGTH)]
    pub building: Account<'info, Building>,
    #[account(mut)]
    pub advisor: Signer<'info>,
    /// CHECK:
    pub originator: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
        // you need to provide the system program whenever you want to initialize an account
}

/* TODO:
#[derive(Accounts)]
pub struct ChangeTokenParameters<'info> {
    #[account(mut, has_one = advisor)]
    pub building: Account<'info, Building>,
    pub advisor: Signer<'info>,
} */

#[account]
pub struct Building {
    pub originator: Pubkey, // 32 bytes
        // the owner of the building
    pub advisor: Pubkey, // the bank which creates the building
    pub token: Pubkey, //mint account
    pub total_supply: i128,
    pub token_to_sell: i64, // 8 bytes
        // % of the total supply available to sell
    pub token_value: i64,
    pub active_annuities: bool, // 1 byte
}

const DISCRIMINATOR_LENGTH: usize = 8; // 8 bytes
const PUBKEY_LENGTH: usize = 32; // PubKey 32 bytes
const TOTAL_SUPPLY_LENGTH: usize = 16; // i128 (bit), so 16 bytes again
const TOKEN_TO_SELL_LENGTH: usize = 8; // i64 (bit), so 8 bytes again
const TOKEN_VALUE_LENGTH: usize = 8; // i64 (bit), so 8 bytes again
//const DATE_LENGTH: usize = 8; // i64 (bit), so 8 bytes again

// to calculate the account size in bytes
impl Building {
    const LENGTH: usize = 
        DISCRIMINATOR_LENGTH +
        PUBKEY_LENGTH * 3 +
        TOTAL_SUPPLY_LENGTH +
        TOKEN_TO_SELL_LENGTH +
        TOKEN_VALUE_LENGTH +
        //DATE_LENGTH * 2 +
        1; // active_annuities (bool)
}

#[error_code]
pub enum ErrorCode{
    #[msg("Unauthorized")]
    UnauthorizedSender,
    #[msg("Unavailable tokens")]
    UnavailableTokens,
    #[msg("Invalid tokens data, messed up with quantities")]
    InvalidTokensData,
    #[msg("Cannot reload the token account")]
    ReloadFail,
    #[msg("Cannot transfer tokens")]
    TransferFail,
}