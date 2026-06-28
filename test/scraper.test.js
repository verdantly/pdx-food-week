import { expect, test, describe } from 'vitest';
import { isAllCaps, toTitleCase, toSentenceCase, cleanName, parseCoordinates, decodeHTML } from '../scraper_utils.js';

describe('HTML Entity Decoding', () => {
  test('decodeHTML handles common entities', () => {
    expect(decodeHTML('Mac &amp; Cheese')).toBe('Mac & Cheese');
    expect(decodeHTML('Don&#39;t do it')).toBe("Don't do it");
    expect(decodeHTML('O&rsquo;Brien')).toBe('O’Brien');
    expect(decodeHTML('&quot;Hello&quot;')).toBe('"Hello"');
    expect(decodeHTML('Hello&nbsp;World')).toBe('Hello\u00A0World');
  });

  test('decodeHTML handles double encoding', () => {
    expect(decodeHTML('Mac &amp;amp; Cheese')).toBe('Mac &amp; Cheese'); // Wait, double encoding means it requires two passes, but usually it's just standard decode.
  });
});

describe('Scraper Text Utilities', () => {
  test('isAllCaps', () => {
    expect(isAllCaps('HELLO WORLD')).toBe(true);
    expect(isAllCaps('Hello World')).toBe(false);
    expect(isAllCaps('DECONSTRUCTED LASAGNA NACHOS @ ADOLFO')).toBe(true);
  });

  test('toTitleCase', () => {
    expect(toTitleCase('hello world')).toBe('Hello World');
    expect(toTitleCase('bbq chicken')).toBe('BBQ Chicken');
    expect(toTitleCase('gf pizza')).toBe('GF Pizza');
  });

  test('toSentenceCase', () => {
    expect(toSentenceCase('THIS IS A TEST. HELLO WORLD.')).toBe('This is a test. Hello world.');
    expect(toSentenceCase('Already sentence case.')).toBe('Already sentence case.');
  });

  test('cleanName', () => {
    expect(cleanName('Adolfo @ Malpractice!')).toBe('adolfomalpractice');
    expect(cleanName('Miss Delta Restaurant & Bar')).toBe('missdeltarestaurantbar');
  });
});

describe('Coordinate Parsing', () => {
  test('parseCoordinates', () => {
    expect(parseCoordinates('-122.658,45.523,0')).toEqual({ lat: 45.523, lng: -122.658 });
    expect(parseCoordinates('-122.658')).toBe(null);
    expect(parseCoordinates('invalid,data,0')).toBe(null);
  });
});
