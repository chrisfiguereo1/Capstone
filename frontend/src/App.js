import React from "react";
// We use Route in order to define the different routes of our application
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import './css/card.css';
import './index.css';

// We import all the components we need in our app
import Navbar from "./components/navbar";
import LandingPage from "./components/pages/landingPage";
import HomePage from "./components/pages/homePage";
import Login from "./components/pages/loginPage";
import Signup from "./components/pages/registerPage";
import PrivateUserProfile from "./components/pages/privateUserProfilePage";
import { createContext, useState, useEffect, useMemo } from "react";
import getUserInfo from "./utilities/decodeJwt";
import FragranceDetailsPage from "./components/pages/fragranceDetailsPage";
import SavedFragrancesPage from "./components/pages/savedFragrancesPage";
import RecommendationEnginePage from "./components/pages/recommendationEnginePage";


export const UserContext = createContext({ user: undefined, setUser: () => {} });
export const ThemeContext = createContext({
  theme: "dark",
  toggleTheme: () => {},
});
//test change
//test again
const RequireAuth = ({ children }) => {
  const location = useLocation();
  const accessToken = localStorage.getItem("accessToken");

  if (!accessToken) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname, aiFinderRedirect: true }}
      />
    );
  }

  return children;
};

const App = () => {
  const [user, setUser] = useState();
  const [theme, setTheme] = useState(
    () => localStorage.getItem("waterscentTheme") || "dark"
  );

  useEffect(() => {
    setUser(getUserInfo());
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("waterscentTheme", theme);
  }, [theme]);

  const userContextValue = useMemo(() => ({ user, setUser }), [user]);
  const themeContextValue = useMemo(
    () => ({
      theme,
      toggleTheme: () =>
        setTheme((currentTheme) =>
          currentTheme === "dark" ? "light" : "dark"
        ),
    }),
    [theme]
  );

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <UserContext.Provider value={userContextValue}>
        <Navbar />
        <Routes>
          <Route exact path="/" element={<LandingPage />} />
          <Route exact path="/home" element={<HomePage />} />
          <Route exact path="/login" element={<Login />} />
          <Route exact path="/signup" element={<Signup />} />
          <Route
            path="/ai-finder"
            element={
              <RequireAuth>
                <RecommendationEnginePage />
              </RequireAuth>
            }
          />
          <Route
            path="/recommendation-engine"
            element={
              <RequireAuth>
                <RecommendationEnginePage />
              </RequireAuth>
            }
          />
          <Route path="/saved" element={<SavedFragrancesPage />} />
          <Route path="/privateUserProfile" element={<PrivateUserProfile />} />
          <Route path="/fragrance/:id" element={<FragranceDetailsPage />} />
        </Routes>
      </UserContext.Provider>
    </ThemeContext.Provider>
  );
};



export default App
