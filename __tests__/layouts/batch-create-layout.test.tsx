import { renderToStaticMarkup } from 'react-dom/server';
import BatchCreateLayout, { metadata } from '@/app/app/create/batch/layout';
import { metadata as createMetadata } from '@/app/app/create/layout';

describe('BatchCreateLayout', () => {
  it('renders its children exactly once', () => {
    const html = renderToStaticMarkup(
      <BatchCreateLayout>
        <div>child content</div>
      </BatchCreateLayout>,
    );

    const matches = html.match(/child content/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('exports a distinct batch create title', () => {
    expect(metadata.title).toBe('Batch create streams');
    expect(metadata.title).not.toBe(createMetadata.title);
  });
});