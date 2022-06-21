/** @jsx jsx */
/* @jsxFrag React.Fragment */

import { jsx } from "@emotion/react";
import { render } from "react-dom";
import PotluckDemo from "./PotluckDemo";

const App = () => {
  return (
    <div className="bg-red" style={{ background: "red !important" }}>
      <p>Why is this not working</p>
      <PotluckDemo />
    </div>
  );
};

render(<App />, document.getElementById("app"));
