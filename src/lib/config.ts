export interface ServerConfig {
  readonly hostname: string;
  readonly port: number;
}

const HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "0.0.0.0"]);

/** Parse only explicit CLI options; no environment or filesystem permissions are needed. */
export function parseConfig(args: readonly string[]): ServerConfig {
  let hostname = "127.0.0.1";
  let port = 8000;
  const seen = new Set<string>();

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === undefined) break;
    const separator = argument.indexOf("=");
    const option = separator < 0 ? argument : argument.slice(0, separator);
    if (option !== "--host" && option !== "--port") {
      throw new TypeError(`Unknown option: ${option}. Use --host or --port.`);
    }
    if (seen.has(option)) throw new TypeError(`Duplicate option: ${option}.`);
    seen.add(option);
    const value = separator < 0 ? args[++index] : argument.slice(separator + 1);
    if (!value || value.startsWith("--")) throw new TypeError(`Missing value for ${option}.`);

    if (option === "--host") {
      if (!HOSTNAMES.has(value)) {
        throw new TypeError("Host must be 127.0.0.1, localhost, ::1, or 0.0.0.0.");
      }
      hostname = value;
    } else {
      const number = Number(value);
      if (!/^\d+$/.test(value) || !Number.isInteger(number) || number < 1 || number > 65535) {
        throw new TypeError("Port must be an integer from 1 to 65535.");
      }
      port = number;
    }
  }
  return { hostname, port };
}

export function serverUrl(config: ServerConfig): string {
  const host = config.hostname.includes(":") ? `[${config.hostname}]` : config.hostname;
  return `http://${host}:${config.port}/`;
}
