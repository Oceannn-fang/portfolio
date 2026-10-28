import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import FilmArchiveModule from '@/components/FilmArchiveModule';
import { filmRolls, findFilmRoll } from '@/lib/film-rolls';

export function generateStaticParams() {
  return filmRolls.map((roll) => ({ rollId: roll.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ rollId: string }> }): Promise<Metadata> {
  const { rollId } = await params;
  const roll = findFilmRoll(rollId);
  if (!roll) return {};
  return {
    title: `${roll.title} | Film Archive`,
    description: `${roll.frames.length} frames from roll ${String(roll.rollNumber).padStart(3, '0')}.`,
    alternates: { canonical: `/film/${roll.id}` },
  };
}

export default async function FilmRollPage({ params }: { params: Promise<{ rollId: string }> }) {
  const { rollId } = await params;
  const roll = findFilmRoll(rollId);
  if (!roll) notFound();
  return <FilmArchiveModule mode="roll" roll={roll} />;
}

