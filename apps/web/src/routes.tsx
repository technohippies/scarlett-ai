import { lazy } from 'solid-js';
import { Route } from '@solidjs/router';
import { HomePage } from './pages/HomePage';
import { SongPage } from './pages/SongPage';

export default function Routes() {
  return (
    <>
      <Route path="/" component={HomePage} />
      <Route path="/:trackId/*" component={SongPage} />
    </>
  );
}