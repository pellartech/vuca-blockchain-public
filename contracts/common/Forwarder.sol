// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

contract Forwarder {
  function forwardPayable(address destination, bytes memory data) public payable {
    (bool success, ) = destination.call{ value: msg.value }(data);
    require(success, "Forwarder: failed to forward");
  }

  function forward(address destination, bytes memory data) public {
    (bool success, ) = destination.call(data);
    require(success, "Forwarder: failed to forward");
  }

  function multiForward(address[] memory destinations, bytes[] memory data) public {
    require(destinations.length == data.length, "Forwarder: destinations and data length mismatch");
    for (uint256 i = 0; i < destinations.length; i++) {
      (bool success, ) = destinations[i].call(data[i]);
      require(success, "Forwarder: failed to forward");
    }
  }

  function tryMultiForward(address[] memory destinations, bytes[] memory data) public returns (bool[] memory) {
    require(destinations.length == data.length, "Forwarder: destinations and data length mismatch");
    bool[] memory results = new bool[](destinations.length);
    for (uint256 i = 0; i < destinations.length; i++) {
      (results[i], ) = destinations[i].call(data[i]);
    }
    return results;
  }

  function tryStaticMultiForward(address[] memory destinations, bytes[] memory data) public view returns (bool[] memory, bytes[] memory) {
    require(destinations.length == data.length, "Forwarder: destinations and data length mismatch");
    bool[] memory results = new bool[](destinations.length);
    bytes[] memory returnData = new bytes[](destinations.length);
    for (uint256 i = 0; i < destinations.length; i++) {
      (results[i], returnData[i]) = destinations[i].staticcall(data[i]);
    }
    return (results, returnData);
  }
}
