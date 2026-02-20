import { clients, offchainMainnet } from '@snapshot-labs/sx';
import { SignClient } from '@walletconnect/sign-client';

const SPACE = 'fabien.eth';
const PROPOSAL =
  '0xc4dda37e4a7fc5b4b66069c2c2d7efc3e350c0aff4edd0d21a08e64bd10d656a';
const CHOICE = 2; // 1 = For, 2 = Against, 3 = Abstain
const VOTE_TYPE = 'basic';

const WC_PROJECT_ID = 'e6454bd61aba40b786e866a69bd4c5c6';

console.log(
  `Proposal: https://snapshot.box/#/s:${SPACE}/proposal/${PROPOSAL}\n`
);

const signClient = await SignClient.init({
  projectId: WC_PROJECT_ID,
  metadata: {
    name: 'futarchist.eth',
    description: '',
    url: 'https://snapshot.box',
    icons: []
  }
});

const { uri, approval } = await signClient.connect({
  optionalNamespaces: {
    eip155: {
      methods: ['eth_signTypedData'],
      chains: ['eip155:1'],
      events: ['chainChanged', 'accountsChanged']
    }
  }
});

console.log(`Paste this URI in your Safe:\n${uri}`);

const session = await approval();
const account = session.namespaces.eip155?.accounts[0];
if (!account) {
  console.error('No account returned');
  process.exit(1);
}

const [, chainId, address] = account.split(':');
console.log(`Connected: ${address} on chain ${chainId}\n`);

const signer = {
  getAddress: async () => address,
  _signTypedData: async (domain: any, types: any, value: any) => {
    console.log('Requesting signature from wallet…\n');
    return signClient.request({
      topic: session.topic,
      chainId: `eip155:${chainId}`,
      request: {
        method: 'eth_signTypedData',
        params: [
          address,
          JSON.stringify({
            types: {
              EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' }
              ],
              ...types
            },
            primaryType: Object.keys(types)[0],
            domain,
            message: value
          })
        ]
      }
    });
  }
} as any;

const client = new clients.OffchainEthereumSig({
  networkConfig: offchainMainnet
});

console.log('Casting vote…\n');
const envelope = await client.vote({
  signer,
  data: {
    from: address,
    space: SPACE,
    proposal: PROPOSAL,
    choice: CHOICE,
    type: VOTE_TYPE,
    authenticator: '',
    strategies: [],
    metadataUri: '',
    privacy: 'none',
    app: 'futarchist'
  }
});

const result = await client.send(envelope);
console.log('Vote submitted:', result);

await signClient.disconnect({
  topic: session.topic,
  reason: { code: 6000, message: 'Done' }
});
process.exit(0);
