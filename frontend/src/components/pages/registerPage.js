import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import API_URL from "../../utilities/api";

const PRIMARY_COLOR = "#cc5c99";
const SECONDARY_COLOR = "#0c0c1f";
const PAGE_BACKGROUND =
  "radial-gradient(circle at top left, rgba(243,215,183,0.18) 0%, transparent 30%), linear-gradient(135deg, #140c08 0%, #2b1b13 52%, #7b5136 100%)";
const url = `${API_URL}/user/signup`;

const Register = () => {
  const [data, setData] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [light, setLight] = useState(false);
  const [bgColor, setBgColor] = useState(SECONDARY_COLOR);
  const [bgText, setBgText] = useState("Light Mode");

  const handleChange = ({ currentTarget: input }) => {
    setData({ ...data, [input.name]: input.value });
  };

  useEffect(() => {
    if (light) {
      setBgColor("white");
      setBgText("Dark mode");
    } else {
      setBgColor(SECONDARY_COLOR);
      setBgText("Light mode");
    }
  }, [light]);

  let labelStyling = {
    color: light ? PRIMARY_COLOR : "#f4dcc1",
    fontWeight: "bold",
    textDecoration: "none",
  };
  let backgroundStyling = { background: light ? bgColor : PAGE_BACKGROUND };
  let formCardStyling = {
    background: light ? "white" : "rgba(20, 12, 8, 0.72)",
    border: light ? "1px solid #efe1cf" : "1px solid rgba(244, 220, 193, 0.18)",
    borderRadius: "26px",
    boxShadow: light ? "0 18px 45px rgba(35, 25, 18, 0.12)" : "0 24px 60px rgba(0, 0, 0, 0.28)",
    padding: "32px",
  };
  let inputStyling = {
    backgroundColor: "#fff8ef",
    border: "1px solid #efe1cf",
    borderRadius: "14px",
    color: "#2b1b13",
    padding: "11px 14px",
  };
  let formTextStyling = {
    color: light ? "#6c5b4d" : "rgba(255,255,255,0.72)",
  };
  let buttonStyling = {
    background: "#fff8ef",
    borderStyle: "none",
    borderRadius: "999px",
    color: "#2b1b13",
    fontWeight: "800",
    padding: "10px 22px",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(url, data);

      // Show confirmation window
      window.alert("Registration successful! Please log in.");
      
      // Navigate to the login page
      navigate("/login");
    } catch (error) {
      if (
        error.response &&
        error.response.status >= 400 &&
        error.response.status <= 500
      ) {
        setError(error.response.data.message);
      }
    }
  };

  return (
    <>
      <section className="vh-100">
        <div className="container-fluid h-custom vh-100">
          <div
            className="row d-flex justify-content-center align-items-center h-100 "
            style={backgroundStyling}
          >
            <div className="col-md-8 col-lg-6 col-xl-4 offset-xl-1">
              <Form style={formCardStyling}>
                <Form.Group className="mb-3" controlId="formBasicEmail">
                  <Form.Label style={labelStyling}>Username</Form.Label>
                  <Form.Control
                    type="username"
                    name="username"
                    onChange={handleChange}
                    placeholder="Enter username"
                    style={inputStyling}
                  />
                  <Form.Text style={formTextStyling}>
                    We just might sell your data
                  </Form.Text>
                </Form.Group>
                <Form.Group className="mb-3" controlId="formBasicEmail">
                  <Form.Label style={labelStyling}>Email</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    onChange={handleChange}
                    placeholder="Enter Email Please"
                    style={inputStyling}
                  />
                  <Form.Text style={formTextStyling}>
                    We just might sell your data
                  </Form.Text>
                </Form.Group>
                <Form.Group className="mb-3" controlId="formBasicPassword">
                  <Form.Label style={labelStyling}>Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="password"
                    placeholder="Password"
                    onChange={handleChange}
                    style={inputStyling}
                  />
                </Form.Group>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="flexSwitchCheckDefault"
                    onChange={() => {
                      setLight(!light);
                    }}
                  />
                  <label
                    className="form-check-label"
                    htmlFor="flexSwitchCheckDefault"
                    style={formTextStyling}
                  >
                    {bgText}
                  </label>
                </div>
                {error && (
                  <div style={labelStyling} className="pt-3">
                    {error}
                  </div>
                )}
                <Button
                  variant="primary"
                  type="submit"
                  onClick={handleSubmit}
                  style={buttonStyling}
                  className="mt-2"
                >
                  Register
                </Button>
              </Form>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Register;
