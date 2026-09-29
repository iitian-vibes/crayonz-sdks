import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Crayonz } from '../src/client';
import { CrayonzError } from '../src/errors';
import { mockFetch } from './test-utils';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('jobs.wait', () => {
  it('polls until the job completes and returns job.result', async () => {
    const { fn, calls } = mockFetch([
      { status: 200, body: { status: 'ok', job: { id: 'j1', job_type: 'design.custom', status: 'queued', progress_pct: 10 } } },
      { status: 200, body: { status: 'ok', job: { id: 'j1', job_type: 'design.custom', status: 'running', progress_pct: 60 } } },
      {
        status: 200,
        body: {
          status: 'ok',
          job: {
            id: 'j1',
            job_type: 'design.custom',
            status: 'completed',
            progress_pct: 100,
            result: { status: 'success', design_id: 'd1', file_url: 'https://x/d.png', print_ready: true },
          },
        },
      },
    ]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn });

    const promise = client.jobs.wait('j1', { interval: 10 });
    await vi.runAllTimersAsync();
    const job = await promise;

    expect(job.status).toBe('completed');
    expect(job.result).toMatchObject({ file_url: 'https://x/d.png' });
    expect(calls.length).toBe(3);
  });

  it('throws when the job fails, carrying last_error', async () => {
    const { fn } = mockFetch([
      {
        status: 200,
        body: { status: 'ok', job: { id: 'j1', job_type: 'design.custom', status: 'failed', last_error: 'model timeout' } },
      },
    ]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn });
    await expect(client.jobs.wait('j1', { interval: 10 })).rejects.toThrow('model timeout');
  });

  it('throws a timeout error when the job never completes in time', async () => {
    const { fn } = mockFetch([
      { status: 200, body: { status: 'ok', job: { id: 'j1', job_type: 'design.custom', status: 'running' } } },
    ]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn });

    const promise = client.jobs.wait('j1', { interval: 10, timeout: 25 });
    const assertion = expect(promise).rejects.toThrow(/did not reach a terminal state/);
    await vi.runAllTimersAsync();
    await assertion;
  });
});

describe('designs.createAndWait', () => {
  it('creates the job then waits for it, returning the design result', async () => {
    const { fn } = mockFetch([
      { status: 202, body: { status: 'queued', job_id: 'j1', poll_url: '/api/jobs/j1' } },
      {
        status: 200,
        body: {
          status: 'ok',
          job: {
            id: 'j1',
            job_type: 'design.custom',
            status: 'completed',
            result: { status: 'success', design_id: 'd1', file_url: 'https://x/d.png', print_ready: true },
          },
        },
      },
    ]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn });

    const promise = client.designs.createAndWait({ idea: 'skate logo' }, { interval: 10 });
    await vi.runAllTimersAsync();
    const design = await promise;

    expect(design.design_id).toBe('d1');
    expect(design.file_url).toBe('https://x/d.png');
  });
});

describe('tasks.wait (VTO)', () => {
  it('polls a try-on task until completed', async () => {
    const { fn } = mockFetch([
      { status: 200, body: { taskId: 't1', status: 'processing' } },
      { status: 200, body: { taskId: 't1', status: 'completed', resultImage: 'https://x/result.jpg' } },
    ]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn });

    const promise = client.tasks.wait('t1', { interval: 10 });
    await vi.runAllTimersAsync();
    const task = await promise;

    expect(task.status).toBe('completed');
    expect(task.resultImage).toBe('https://x/result.jpg');
  });

  it('throws when the task fails', async () => {
    const { fn } = mockFetch([{ status: 200, body: { taskId: 't1', status: 'failed', error: 'no face detected' } }]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn });
    await expect(client.tasks.wait('t1', { interval: 10 })).rejects.toThrow('no face detected');
  });
});

describe('simple resource wrappers hit the right path + body', () => {
  it('mockups.render', async () => {
    const { fn, calls } = mockFetch([{ status: 200, body: { status: 'success', mockup_url: 'https://x/m.png', garment: 'tshirt', color: { name: 'Black', hex: '#1A1A1A' }, view: 'front', credits_charged: 10 } }]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn });
    const result = await client.mockups.render({ design_url: 'https://x/d.png', garment: 'tshirt' });
    expect(calls[0].url).toBe('https://api.crayonz.ai/api/mockup/render');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ design_url: 'https://x/d.png', garment: 'tshirt' });
    expect(result.credits_charged).toBe(10);
  });

  it('quality.score', async () => {
    const { fn, calls } = mockFetch([{ status: 200, body: { status: 'scored', recommendation: 'approve', scores: {}, issues: [], strengths: [], scored_at: 'now' } }]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn });
    await client.quality.score({ image_url: 'https://x/d.png', design_brief: 'a logo' });
    expect(calls[0].url).toBe('https://api.crayonz.ai/api/quality/score');
  });

  it('photoshoots.model / product / recommendVibes', async () => {
    const { fn, calls } = mockFetch([
      { status: 200, body: { shots: [], requested: 1, succeeded: 0, model_used: 'x' } },
      { status: 200, body: { shots: [], model_used: 'x' } },
      { status: 200, body: { recommendations: [], model_used: 'x' } },
    ]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn });
    await client.photoshoots.model({ design_reference_url: 'https://x/d.png' });
    await client.photoshoots.product({ compositor_flatlay_url: 'https://x/m.png', shot_types: ['packshot_white'] });
    await client.photoshoots.recommendVibes({ title: 'A logo' });
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.crayonz.ai/api/photoshoot/v3/generate',
      'https://api.crayonz.ai/api/photoshoot/v3/generate-product',
      'https://api.crayonz.ai/api/photoshoot/recommend-vibes',
    ]);
  });

  it('tryOn.create / variations', async () => {
    const { fn, calls } = mockFetch([
      { status: 202, body: { taskId: 't1', status: 'queued' } },
      { status: 202, body: { taskId: 't2', status: 'queued' } },
    ]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn });
    await client.tryOn.create({ userPhoto: 'a', productImage: 'b' });
    await client.tryOn.variations({ userPhoto: 'a', productImage: 'b' });
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.crayonz.ai/v1/try-on',
      'https://api.crayonz.ai/v1/try-on/variations',
    ]);
  });

  it('sizing.recommend', async () => {
    const { fn, calls } = mockFetch([{ status: 200, body: { recommendedSize: 'M', reasoning: 'x' } }]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn });
    const result = await client.sizing.recommend({ image: 'https://x/tee.png', sizeChart: 'S:36 M:40' });
    expect(calls[0].url).toBe('https://api.crayonz.ai/v1/size-recommendation');
    expect(result.recommendedSize).toBe('M');
  });

  it('outfits.complete', async () => {
    const { fn, calls } = mockFetch([{ status: 200, body: { outfits: [], summary: 'x' } }]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn });
    await client.outfits.complete({ productImages: ['https://x/tee.png'] });
    expect(calls[0].url).toBe('https://api.crayonz.ai/v1/complete-outfit');
  });

  it('designs.get', async () => {
    const { fn, calls } = mockFetch([{ status: 200, body: { status: 'ok', design: { id: 'd1', file_url: 'https://x/d.png', created_at: 'now' } } }]);
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: fn });
    await client.designs.get('d1');
    expect(calls[0].url).toBe('https://api.crayonz.ai/api/designs/d1');
  });
});

describe('CrayonzError on network failure', () => {
  it('wraps a thrown network error', async () => {
    const failing = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const client = new Crayonz({ apiKey: 'cz_test_abc', fetch: failing, maxRetries: 0 });
    await expect(client.designs.list()).rejects.toBeInstanceOf(CrayonzError);
    await expect(client.designs.list()).rejects.toThrow(/Network error/);
  });
});
