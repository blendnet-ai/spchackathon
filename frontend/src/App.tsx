import { Route, Routes } from "react-router-dom";
import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import HackathonMeeting from "./Meeting";

const App = () => {
  return (
    <Fragment>
      <Routes>
        <Route path={"/meeting"} element={<HackathonMeeting />} />
      </Routes>
    </Fragment>
  );
};

export default App;
