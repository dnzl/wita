import React from "react";
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Guess the author!</h1>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
