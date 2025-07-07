/**
 * UUID polyfill that provides the same interface as the uuid package
 * but uses the built-in crypto.randomUUID() function
 */

// Export v4 function (the most commonly used one)
export function v4(): string {
  return crypto.randomUUID();
}

// Export as default for compatibility
export default v4;

// Export other UUID versions for completeness (though we only use v4)
export function v1(): string {
  // v1 is timestamp-based, but we'll use v4 for simplicity
  return crypto.randomUUID();
}

export function v3(): string {
  // v3 is MD5-based, but we'll use v4 for simplicity
  return crypto.randomUUID();
}

export function v5(): string {
  // v5 is SHA-1-based, but we'll use v4 for simplicity
  return crypto.randomUUID();
}

// Export the main functions as named exports
export { v4 as uuidv4 }; 