// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// RISC Zero's mock verifier, built with the contracts so that scripts/contracts/deploy.mjs can put it
// under ZkReferee on a local chain, which has no RISC Zero verifier (plan M4.10).
import {RiscZeroMockVerifier} from "risc0/test/RiscZeroMockVerifier.sol";
