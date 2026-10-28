import type { Metadata } from 'next';
import FilmArchiveModule from '@/components/FilmArchiveModule';

export const metadata: Metadata = {
  title: 'Film Archive',
  description: 'A personal archive of scanned film rolls.',
  alternates: { canonical: '/film' },
};

export default function FilmArchivePage() {
  return <FilmArchiveModule mode="archive" />;
}

