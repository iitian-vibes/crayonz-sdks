# @crayonz-ai/sdk

Official TypeScript / JavaScript SDK for the [Crayonz AI](https://crayonz.ai) API — meme, content, and design generation.

## Install

```bash
npm install @crayonz-ai/sdk
# or
pnpm add @crayonz-ai/sdk
# or
yarn add @crayonz-ai/sdk
```

## Quickstart

```ts
import { Crayonz } from '@crayonz-ai/sdk';

const client = new Crayonz({ apiKey: process.env.CRAYONZ_API_KEY! });

// Generate memes
const memes = await client.memes.generate({
  topic: 'coding',
  tone: 'sarcastic',
  count: 3,
});
console.log(memes.memes[0].image_url);

// Generate a blog post
const blog = await client.content.generateBlog({
  topic: 'campus life productivity',
  target_length: 1500,
});

// Generate a design
const design = await client.design.generate({
  prompt: 'minimalist mountain logo',
  style: 'vector',
});
```

## Authentication

Get an API key at [crayonz.ai/api-console/keys](https://crayonz.ai/api-console/keys). Keys begin with `cz_live_` (production) or `cz_test_` (sandbox, free).

## Cost-allocation tags

Group usage across projects with the `tag` option:

```ts
const client = new Crayonz({
  apiKey: process.env.CRAYONZ_API_KEY!,
  tag: 'project=launch-campaign',
});
```

The tag shows up in the [usage dashboard](https://crayonz.ai/api-console/usage) under "By Tag".

## Error handling

```ts
import { Crayonz, CrayonzError } from '@crayonz-ai/sdk';

try {
  await client.memes.generate({ topic: 'x' });
} catch (e) {
  if (e instanceof CrayonzError) {
    console.error(e.status, e.endpoint, e.body);
  }
}
```

## Configuration

```ts
new Crayonz({
  apiKey: 'cz_live_…',
  tag: 'project=foo',         // optional cost tag
  timeoutMs: 60_000,          // default 60s
  baseUrls: {                 // override service URLs (rare)
    memes: 'https://…',
    content: 'https://…',
    design: 'https://…',
  },
  fetch: customFetch,         // override fetch (e.g. node-fetch)
});
```

## Requirements

Node.js 18+ (uses native `fetch`).

## License

MIT
