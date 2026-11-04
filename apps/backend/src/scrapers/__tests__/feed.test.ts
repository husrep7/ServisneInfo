import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed } from '../feed';

test('parseFeed: RSS 2.0 (WordPress) sa content:encoded i kategorijama', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel><title>KJKP Sarajevogas</title>
  <item>
    <title>Servisna informacija</title>
    <link>https://www.sarajevogas.ba/servisna-informacija/</link>
    <pubDate>Wed, 04 Nov 2026 12:07:53 +0000</pubDate>
    <category><![CDATA[servisna informacija]]></category>
    <description><![CDATA[Kratko [&#8230;]]]></description>
    <content:encoded><![CDATA[<p>Prekid isporuke gasa u ulici <b>Gatačka</b>.</p>]]></content:encoded>
  </item>
</channel></rss>`;
  const [item] = parseFeed(xml);
  assert.equal(item.title, 'Servisna informacija');
  assert.equal(item.link, 'https://www.sarajevogas.ba/servisna-informacija/');
  assert.equal(item.description, 'Prekid isporuke gasa u ulici Gatačka.');
  assert.equal(item.publishedAt?.toISOString(), '2026-11-04T12:07:53.000Z');
  assert.deepEqual(item.categories, ['servisna informacija']);
});

test('parseFeed: Atom', () => {
  const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Izvor</title>
  <entry>
    <title>Radovi na mreži</title>
    <link rel="alternate" href="https://izvor.ba/radovi"/>
    <published>2026-11-05T08:00:00Z</published>
    <summary>Bez vode od 9 do 14h</summary>
    <category term="voda"/>
  </entry>
</feed>`;
  const [item] = parseFeed(xml);
  assert.equal(item.title, 'Radovi na mreži');
  assert.equal(item.link, 'https://izvor.ba/radovi');
  assert.equal(item.description, 'Bez vode od 9 do 14h');
  assert.deepEqual(item.categories, ['voda']);
});
