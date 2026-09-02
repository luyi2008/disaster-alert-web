/** Map browser loopback aliases to the BFF default trusted origin host. */
export function rewriteLoopbackHost(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }
  return value.replace("://localhost", "://127.0.0.1").replace("://[::1]", "://127.0.0.1");
}
