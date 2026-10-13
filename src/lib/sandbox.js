import { VM } from "@ethereumjs/vm";
import { Common, Hardfork } from "@ethereumjs/common";
import { LegacyTransaction } from "@ethereumjs/tx";
import {
  Account,
  Address,
  hexToBytes,
  bytesToHex,
  privateToAddress,
} from "@ethereumjs/util";
import { Interface, randomBytes } from "ethers";
function fail(result) {
  if (!result.execResult.exceptionError) return;
  const data = bytesToHex(result.execResult.returnValue);
  let reason = result.execResult.exceptionError.error;
  try {
    const decoded = new Interface([
      "error Error(string)",
      "error Panic(uint256)",
    ]).parseError(data);
    if (decoded) reason = decoded.name + ": " + decoded.args.join(", ");
  } catch {}
  throw Error("Sandbox transaction reverted: " + reason);
}
export class Sandbox {
  static async create(keys) {
    const s = new Sandbox();
    s.common = Common.custom({ chainId: 31337 }, { hardfork: Hardfork.Paris });
    s.vm = await VM.create({ common: s.common });
    s.height = 0;
    s.receipts = [];
    s.accounts = (keys || [randomBytes(32), randomBytes(32)]).map((key) => ({
      key,
      address: new Address(privateToAddress(key)),
      hex: bytesToHex(privateToAddress(key)),
    }));
    for (const a of s.accounts)
      await s.vm.stateManager.putAccount(
        a.address,
        Account.fromAccountData({ balance: 1000n * 10n ** 18n }),
      );
    return s;
  }
  async send(data, to, account = 0, value = 0n) {
    const a = this.accounts[account],
      state = await this.vm.stateManager.getAccount(a.address);
    const tx = LegacyTransaction.fromTxData(
      {
        nonce: state.nonce,
        gasLimit: 8000000n,
        gasPrice: 1000000000n,
        data,
        ...(to ? { to } : {}),
        value,
      },
      { common: this.common },
    ).sign(a.key);
    const result = await this.vm.runTx({
      tx,
      skipBlockGasLimitValidation: true,
    });
    fail(result);
    this.height++;
    const receipt = {
      hash: bytesToHex(tx.hash()),
      gasUsed: result.totalGasSpent.toString(),
      blockNumber: this.height,
      logs: result.execResult.logs || [],
      status: 1,
      sandbox: true,
    };
    this.receipts.push(receipt);
    return { ...receipt, address: result.createdAddress?.toString() };
  }
  async deploy(artifact, args = [], account = 0) {
    return this.send(
      artifact.bytecode +
        new Interface(artifact.abi).encodeDeploy(args).slice(2),
      null,
      account,
    );
  }
  async write(address, abi, fn, args = [], account = 0) {
    return this.send(
      new Interface(abi).encodeFunctionData(fn, args),
      address,
      account,
    );
  }
  async read(address, abi, fn, args = [], account = 0) {
    const iface = new Interface(abi),
      result = await this.vm.evm.runCall({
        to: Address.fromString(address),
        caller: this.accounts[account].address,
        data: hexToBytes(iface.encodeFunctionData(fn, args)),
        isStatic: true,
      });
    fail({ execResult: result.execResult });
    return iface.decodeFunctionResult(
      fn,
      bytesToHex(result.execResult.returnValue),
    );
  }
  async code(address) {
    return bytesToHex(
      await this.vm.stateManager.getContractCode(Address.fromString(address)),
    );
  }
}
