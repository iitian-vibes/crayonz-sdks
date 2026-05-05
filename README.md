# Crayonz SDKs

Official client libraries for the [Crayonz AI](https://crayonz.ai) API.

| Language | Package | Install |
|---|---|---|
| TypeScript / JavaScript | [`@crayonz-ai/sdk`](https://www.npmjs.com/package/@crayonz-ai/sdk) | `npm install @crayonz-ai/sdk` |
| Python | [`crayonz`](https://pypi.org/project/crayonz/) | `pip install crayonz` |

Both SDKs cover the full Crayonz API: meme generation, content (blog/Instagram), and design pipeline (trends, generate, mockups, scoring, custom variations).

## TypeScript

```ts
import { Crayonz } from '@crayonz-ai/sdk';

const client = new Crayonz({ apiKey: process.env.CRAYONZ_API_KEY! });
const memes = await client.memes.generate({ topic: 'coding', count: 3 });
```

Full docs: [`typescript/README.md`](./typescript/README.md)

## Python

```python
from crayonz import Client

client = Client(api_key="cz_live_...")
memes = client.memes.generate(topic="coding", count=3)
```

Full docs: [`python/README.md`](./python/README.md)

## Releasing

Publishing both SDKs is automated by `.github/workflows/publish.yml`. Push a SemVer git tag and it ships:

```bash
git tag v0.1.1
git push origin v0.1.1
```

Both `@crayonz-ai/sdk@0.1.1` and `crayonz==0.1.1` go live on the registries within ~2 minutes.

Bump versions in `typescript/package.json` and `python/pyproject.toml` together so registries stay in lockstep.

## License

MIT
