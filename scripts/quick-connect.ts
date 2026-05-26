// Quick connectivity test - connects, verifies, exits
import { WeComWsProvider } from "../packages/providers/src/wecom/ws-provider";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

var BOT_ID = process.env.WECOM_BOT_ID as string;
var BOT_SECRET = process.env.WECOM_BOT_SECRET as string;

async function main() {
  var provider = new WeComWsProvider();
  var connected = false;
  
  provider.onMessage(function(frame) {
    var msg = frame.body?.text?.content || "";
    process.stdout.write("[MSG] " + msg + "\n");
  });

  try {
    process.stdout.write("Connecting to WeCom WS...\n");
    await provider.connect({ botId: BOT_ID, botSecret: BOT_SECRET });
    connected = true;
    process.stdout.write("CONNECTED OK\n");
    
    // Wait 3 seconds to see if any messages come in, then disconnect
    await new Promise(function(r) { return setTimeout(r, 3000); });
    
    provider.disconnect();
    process.stdout.write("Disconnected. Test complete.\n");
    process.exit(0);
  } catch (e) {
    process.stderr.write("FAILED: " + (e as Error).message + "\n");
    process.exit(1);
  }
}

main();
