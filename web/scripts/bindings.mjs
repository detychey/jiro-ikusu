// Generates web/src/chain/bindings/<Name>.ts, the typed ethers v6 binding of each contract ABI in
// contracts/abi/ (plan M5.1), so the web app's contract calls are typed from the ABIs that
// scripts/contracts/abi.sh writes, never by hand. A binding imports its ABI's JSON and declares:
// - <Name>, the contract's functions as ethers BaseContractMethods: a view or pure function
//   resolves to its result, any other function to its transaction;
// - a <Struct>Input and a <Struct> type for each struct, as a call takes and returns it;
// - <Name>Events, each event's arguments by name, if the contract has events;
// - connect<Name>(address, runner).
// Solidity integers are bigints, as ethers v6 returns them. An ABI with no entries, a library's,
// has no binding. The directory is rewritten whole, so a deleted ABI's binding goes with it.
// Usage: node web/scripts/bindings.mjs; CI then checks it for drift (scripts/check-drift.sh).
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ABI_DIR = join(REPO_ROOT, "contracts", "abi");
const OUT_DIR = join(REPO_ROOT, "web", "src", "chain", "bindings");
const READ_ONLY = ["view", "pure"];

function fail(where, problem) {
  throw new Error(`bindings: ${where}: ${problem}`);
}

/** The struct name of a tuple parameter, from its internalType: "struct Outcome[6]" is Outcome. */
function structNameOf(where, param) {
  const match = /^struct (?:\w+\.)?(\w+)(?:\[\d*\])*$/.exec(param.internalType ?? "");
  if (!match) fail(where, `tuple ${param.name} has no struct name in its internalType ${JSON.stringify(param.internalType)}`);
  return match[1];
}

/**
 * The TypeScript type of an ABI parameter: `input` types what a call takes, the others what it
 * returns. Each struct met is recorded in `structs`, by name.
 */
function typeOf(where, param, input, structs) {
  const array = /^(.*)\[\d*\]$/.exec(param.type);
  if (array) return `${typeOf(where, { ...param, type: array[1] }, input, structs)}[]`;
  if (param.type === "tuple") {
    const name = structNameOf(where, param);
    const components = JSON.stringify(param.components);
    if (structs.has(name) && JSON.stringify(structs.get(name)) !== components) fail(where, `two structs are named ${name}`);
    structs.set(name, param.components);
    return input ? `${name}Input` : name;
  }
  if (/^u?int\d*$/.test(param.type)) return input ? "BigNumberish" : "bigint";
  if (param.type === "address") return input ? "AddressLike" : "string";
  if (/^bytes\d*$/.test(param.type)) return input ? "BytesLike" : "string";
  if (param.type === "bool") return "boolean";
  if (param.type === "string") return "string";
  return fail(where, `unsupported ABI type ${param.type}`);
}

function fieldsOf(where, params, input, structs) {
  return params.map((param, index) => {
    if (!param.name) fail(where, `parameter ${index} has no name`);
    return `${param.name}: ${typeOf(where, param, input, structs)}`;
  });
}

/** A function's result: its one output, or ethers' Result as a tuple that also has the outputs' names. */
function resultOf(where, outputs, structs) {
  if (outputs.length === 0) return "void";
  if (outputs.length === 1) return typeOf(where, outputs[0], false, structs);
  const tuple = `[${outputs.map((output) => typeOf(where, output, false, structs)).join(", ")}]`;
  if (outputs.some((output) => !output.name)) return tuple;
  return `${tuple} & { ${fieldsOf(where, outputs, false, structs).join("; ")} }`;
}

function methodOf(contract, fragment, structs) {
  const where = `${contract}.${fragment.name}`;
  const args = fragment.inputs.map((input, index) => `${input.name || `arg${index}`}: ${typeOf(where, input, true, structs)}`);
  const result = resultOf(where, fragment.outputs, structs);
  const resolves = READ_ONLY.includes(fragment.stateMutability) ? result : "ContractTransactionResponse";
  return `  ${fragment.name}: BaseContractMethod<[${args.join(", ")}], ${result}, ${resolves}>;`;
}

function uniqueNames(contract, fragments) {
  const seen = new Set();
  for (const { type, name } of fragments) {
    if (seen.has(name)) fail(contract, `${type} ${name} is overloaded, which the bindings do not support`);
    seen.add(name);
  }
}

/** Struct types, each in its call and its result form, in the order the ABI first uses them. */
function structTypes(structs) {
  const lines = [];
  const written = new Set();
  // Writing a struct can record nested structs, so the map is walked until nothing new appears.
  while (written.size < structs.size) {
    for (const [name, components] of [...structs]) {
      if (written.has(name)) continue;
      written.add(name);
      lines.push(
        `export interface ${name}Input {\n${fieldsOf(name, components, true, structs).map((field) => `  ${field};`).join("\n")}\n}`,
        `export interface ${name} {\n${fieldsOf(name, components, false, structs).map((field) => `  ${field};`).join("\n")}\n}`,
      );
    }
  }
  return lines;
}

const ETHERS_TYPES = [
  "AddressLike",
  "BaseContract",
  "BaseContractMethod",
  "BigNumberish",
  "BytesLike",
  "ContractRunner",
  "ContractTransactionResponse",
];

function bindingOf(contract, abi) {
  const functions = abi.filter((entry) => entry.type === "function");
  const events = abi.filter((entry) => entry.type === "event");
  uniqueNames(contract, functions);
  uniqueNames(contract, events);
  const structs = new Map();
  const methods = functions.map((fragment) => methodOf(contract, fragment, structs));
  const eventTypes = events.map(
    (event) => `  ${event.name}: { ${fieldsOf(`${contract}.${event.name}`, event.inputs, false, structs).join("; ")} };`,
  );
  const body = [
    `export const ${contract.toUpperCase()}_ABI = abi;`,
    "",
    ...structTypes(structs).flatMap((type) => [type, ""]),
    `export interface ${contract} extends BaseContract {`,
    ...methods,
    "}",
    "",
    ...(events.length === 0 ? [] : [`export interface ${contract}Events {`, ...eventTypes, "}", ""]),
    `export function connect${contract}(address: string, runner: ContractRunner): ${contract} {`,
    `  return new Contract(address, abi, runner) as unknown as ${contract};`,
    "}",
    "",
  ].join("\n");
  const types = ETHERS_TYPES.filter((type) => new RegExp(`\\b${type}\\b`).test(body)).map((type) => `type ${type}`);
  return [
    `// Generated by web/scripts/bindings.mjs from contracts/abi/${contract}.json: do not edit.`,
    "",
    `import { Contract, ${types.join(", ")} } from "ethers";`,
    `import abi from "../../../../contracts/abi/${contract}.json";`,
    "",
    body,
  ].join("\n");
}

function main() {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const written = [];
  for (const file of readdirSync(ABI_DIR).filter((name) => name.endsWith(".json")).sort()) {
    const contract = basename(file, ".json");
    const abi = JSON.parse(readFileSync(join(ABI_DIR, file), "utf8"));
    if (!Array.isArray(abi)) fail(file, "is not an ABI array");
    if (abi.length === 0) continue;
    writeFileSync(join(OUT_DIR, `${contract}.ts`), bindingOf(contract, abi));
    written.push(contract);
  }
  console.log(`bindings: ${written.join(", ")} in web/src/chain/bindings/`);
}

main();
