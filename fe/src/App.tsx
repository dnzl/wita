import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import Game from "./pages/game";
import HomePage from "./pages/home";
import Layout from "./pages/layout";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="game/:id" element={<Game />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
