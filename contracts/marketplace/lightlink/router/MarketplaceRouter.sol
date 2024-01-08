// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../../common/IMarketplaceRegistry.sol";

contract AdotRouter is Initializable, UUPSUpgradeable {
  // variables
  address public registry;

  mapping(address => uint256) public counter;

  event Forwarded(bytes32 indexed serviceId, bytes funcEncodeWithSignature);

  // verified
  modifier requireMultisig() {
    require(msg.sender == IMarketplaceRegistry(registry).getMultisig(), "Multisig required");
    _;
  }

  receive() external payable {
    revert("Not supported");
  }

  function initialize(address _registry) public initializer {
    __AdotRouter_init(_registry);
  }

  /* Execute */
  function __AdotRouter_init(address _registry) internal {
    registry = _registry;
  }

  function _authorizeUpgrade(address) internal override requireMultisig {}

  // if need _signatures // [0]: user signature, [1]: system signature
  function forwardRequest(bytes32 _serviceId, bytes calldata _funcEncodeWithSignature) external {
    address service = IMarketplaceRegistry(registry).getService(_serviceId);
    require(service != address(0), "Service not implemented");

    (bool success, ) = service.call(_funcEncodeWithSignature);

    require(success, "Forward failed");

    emit Forwarded(_serviceId, _funcEncodeWithSignature);
  }

  function forwardStaticcallRequest(bytes32 _serviceId, bytes calldata bytesCaller) public view returns (bool, bytes memory) {
    address service = IMarketplaceRegistry(registry).getService(_serviceId);
    (bool success, bytes memory message) = service.staticcall(bytesCaller);

    return (success, message);
  }

  function forwardMultiStaticcallRequest(bytes32[] calldata _serviceIds, bytes[] calldata bytesCallers) public view returns (bool[] memory, bytes[] memory) {
    require(_serviceIds.length == bytesCallers.length, "Invalid length");

    bool[] memory success = new bool[](_serviceIds.length);
    bytes[] memory message = new bytes[](_serviceIds.length);

    for (uint256 i = 0; i < _serviceIds.length; i++) {
      (success[i], message[i]) = forwardStaticcallRequest(_serviceIds[i], bytesCallers[i]);
    }

    return (success, message);
  }
}
