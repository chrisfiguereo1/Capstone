import React, { useState, useEffect, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import getUserInfo from "../../utilities/decodeJwt";
import API_URL from "../../utilities/api";
import { UserContext } from "../../App";

const url = `${API_URL}/user/login`;

const Login = () => {
  const { user, setUser } = useContext(UserContext);
  const [data, setData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  let labelStyling = {
    color: "var(--ws-accent)",
    fontWeight: "800",
    textDecoration: "none",
  };
  let backgroundStyling = { background: "var(--ws-hero-bg)" };
  let formCardStyling = {
    background: "var(--ws-card-solid)",
    border: "1px solid var(--ws-border)",
    borderRadius: "26px",
    boxShadow: "var(--ws-card-shadow)",
    padding: "32px",
  };
  let inputStyling = {
    backgroundColor: "var(--ws-input-bg)",
    border: "1px solid var(--ws-accent-2)",
    borderRadius: "14px",
    color: "var(--ws-brown)",
    padding: "11px 14px",
  };
  let formTextStyling = {
    color: "var(--ws-muted)",
  };
  let helperLinkStyling = {
    color: "var(--ws-accent)",
    fontWeight: "800",
    textDecoration: "none",
  };
  let buttonStyling = {
    background: "var(--ws-button-bg)",
    borderStyle: "none",
    borderRadius: "999px",
    color: "var(--ws-button-text)",
    fontWeight: "800",
    padding: "10px 22px",
  };

  const handleChange = ({ currentTarget: input }) => {
    setData({ ...data, [input.name]: input.value });
  };

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data: res } = await axios.post(url, data);
      const { accessToken } = res;
      //store token in localStorage
      localStorage.setItem("accessToken", accessToken);
      setUser(getUserInfo());
      navigate("/");
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
            style={backgroundStyling}>
            <div className="col-md-8 col-lg-6 col-xl-4 offset-xl-1">
              <Form onSubmit={handleSubmit} style={formCardStyling}>
                <Form.Group className="mb-3" controlId="formBasicEmail">
                  <Form.Label style={labelStyling}>Username</Form.Label>
                  <Form.Control
                    type="username"
                    name="username"
                    onChange={handleChange}
                    placeholder="Enter username"
                    style={inputStyling}
                  />
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
                <Form.Group className="mb-3" controlId="formBasicCheckbox">
                  <Form.Text className="pt-1" style={formTextStyling}>
                    Dont have an account?
                    <span>
                      <Link to="/signup" style={helperLinkStyling}> Sign up
                      </Link>
                    </span>
                  </Form.Text>
                </Form.Group>
                {error && <div style={labelStyling} className='pt-3'>{error}</div>}
                <Button
                  variant="primary"
                  type="submit"
                  style={buttonStyling}
                  className='mt-2'
                >
                  Log In
                </Button>
              </Form>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Login;
