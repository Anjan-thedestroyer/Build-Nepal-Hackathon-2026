// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {DMalpot} from "../src/DMalpot.sol";
import {console} from "forge-std/console.sol";

contract DeployDMalpot is Script {
  function run() external {
    uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
    vm.startBroadcast(deployerPrivateKey);
    address initialAdmin = vm.addr(deployerPrivateKey);
    DMalpot dMalpot = new DMalpot(initialAdmin);
    vm.stopBroadcast();

    console.log("DMalpot:", address(dMalpot));
    console.log("Owner:", initialAdmin);
  }

}