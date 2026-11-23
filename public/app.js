// public/app.js
// Frontend authentication client-side script for login, registration, and strength checks

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const authCard = document.getElementById("auth-main-card");
  const loginForm = document.getElementById("login-auth-form");
  const registerForm = document.getElementById("register-auth-form");
  
  const goToRegisterBtn = document.getElementById("go-to-register");
  const goToLoginBtn = document.getElementById("go-to-login");
  
  const alertBanner = document.getElementById("status-alert-banner");
  const alertText = document.getElementById("status-alert-text");
  
  const loginEmailInput = document.getElementById("login-email-input");
  const loginPasswordInput = document.getElementById("login-password-input");
  const loginLoader = document.getElementById("login-loader");
  const loginSubmitBtn = document.getElementById("login-submit-button");
  
  const registerFirstNameInput = document.getElementById("register-first-name-input");
  const registerLastNameInput = document.getElementById("register-last-name-input");
  const registerEmailInput = document.getElementById("register-email-input");
  const registerPasswordInput = document.getElementById("register-password-input");
  const registerTermsCheckbox = document.getElementById("register-terms-checkbox");
  const registerLoader = document.getElementById("register-loader");
  const registerSubmitBtn = document.getElementById("register-submit-button");
  
  const loginPassToggle = document.getElementById("login-password-toggle");
  const registerPassToggle = document.getElementById("register-password-toggle");
  
  const passwordStrengthProgress = document.getElementById("password-strength-progress");
  const passwordStrengthLabel = document.getElementById("password-strength-label");

  // ─── Setup views switching ──────────────────────────────────────────────────

  goToRegisterBtn.addEventListener("click", () => {
    hideAlert();
    loginForm.classList.remove("active-form");
    loginForm.classList.add("hidden-form");
    
    registerForm.classList.remove("hidden-form");
    registerForm.classList.add("active-form");
    
    // Animate glowing orbs for visual dynamic vibe
    shiftOrbs(true);
  });

  goToLoginBtn.addEventListener("click", () => {
    hideAlert();
    registerForm.classList.remove("active-form");
    registerForm.classList.add("hidden-form");
    
    loginForm.classList.remove("hidden-form");
    loginForm.classList.add("active-form");
    
    shiftOrbs(false);
  });

  // Background design shift
  function shiftOrbs(toRegister) {
    const orb1 = document.getElementById("orb-1");
    const orb2 = document.getElementById("orb-2");
    
    if (toRegister) {
      orb1.style.transform = "translate(100px, 100px) scale(1.2)";
      orb2.style.transform = "translate(-100px, -100px) scale(0.8)";
    } else {
      orb1.style.transform = "none";
      orb2.style.transform = "none";
    }
  }

  // ─── Password Visibility Toggle ─────────────────────────────────────────────

  function setupPasswordToggle(toggleBtn, inputEl) {
    toggleBtn.addEventListener("click", () => {
      const isPassword = inputEl.type === "password";
      inputEl.type = isPassword ? "text" : "password";
      
      const eyeShow = toggleBtn.querySelector(".eye-show");
      const eyeHide = toggleBtn.querySelector(".eye-hide");
      
      if (isPassword) {
        eyeShow.classList.add("hidden");
        eyeHide.classList.remove("hidden");
      } else {
        eyeShow.classList.remove("hidden");
        eyeHide.classList.add("hidden");
      }
    });
  }

  setupPasswordToggle(loginPassToggle, loginPasswordInput);
  setupPasswordToggle(registerPassToggle, registerPasswordInput);

  // ─── Realtime Password Strength Checks ──────────────────────────────────────

  registerPasswordInput.addEventListener("input", (e) => {
    const value = e.target.value;
    const strength = evaluatePasswordStrength(value);
    updateStrengthBar(strength);
  });

  function evaluatePasswordStrength(password) {
    if (!password) return 0;
    
    let score = 0;
    
    // Length check
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    
    // Character variations
    if (/[A-Z]/.test(password)) score++; // uppercase
    if (/[0-9]/.test(password)) score++; // numbers
    if (/[^A-Za-z0-9]/.test(password)) score++; // special chars
    
    return score;
  }

  function updateStrengthBar(score) {
    // Reset classes
    passwordStrengthProgress.className = "strength-bar-progress";
    
    if (score === 0) {
      passwordStrengthProgress.style.width = "0%";
      passwordStrengthLabel.textContent = "Strength: Empty";
      passwordStrengthLabel.style.color = "var(--text-muted)";
    } else if (score <= 2) {
      passwordStrengthProgress.classList.add("strength-weak");
      passwordStrengthLabel.textContent = "Strength: Weak (Add uppercase/digits/symbols)";
      passwordStrengthLabel.style.color = "var(--color-error)";
    } else if (score === 3) {
      passwordStrengthProgress.classList.add("strength-fair");
      passwordStrengthLabel.textContent = "Strength: Medium";
      passwordStrengthLabel.style.color = "var(--color-warning)";
    } else if (score === 4) {
      passwordStrengthProgress.classList.add("strength-good");
      passwordStrengthLabel.textContent = "Strength: Good";
      passwordStrengthLabel.style.color = "var(--accent-primary)";
    } else {
      passwordStrengthProgress.classList.add("strength-strong");
      passwordStrengthLabel.textContent = "Strength: Very Strong";
      passwordStrengthLabel.style.color = "var(--color-success)";
    }
  }

  // ─── Alert Helpers ──────────────────────────────────────────────────────────

  function showAlert(message, type = "error") {
    alertBanner.className = `alert-banner ${type}`;
    
    // Set icon
    const iconSpan = document.getElementById("status-alert-icon");
    if (type === "error") {
      iconSpan.innerHTML = `✕`;
    } else if (type === "success") {
      iconSpan.innerHTML = `✓`;
    } else {
      iconSpan.innerHTML = `ℹ`;
    }
    
    alertText.textContent = message;
    alertBanner.classList.remove("hidden");
  }

  function hideAlert() {
    alertBanner.classList.add("hidden");
  }

  // ─── Form Validations & Field Errors ────────────────────────────────────────

  function clearErrors() {
    const errorContainers = document.querySelectorAll(".error-msg");
    errorContainers.forEach((e) => {
      e.textContent = "";
    });
  }

  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  }

  // ─── Submit Forms ───────────────────────────────────────────────────────────

  // Login Submit
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();
    hideAlert();
    
    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value;
    
    let hasError = false;
    
    if (!email) {
      document.getElementById("login-email-error").textContent = "Email is required";
      hasError = true;
    } else if (!validateEmail(email)) {
      document.getElementById("login-email-error").textContent = "Enter a valid email address";
      hasError = true;
    }
    
    if (!password) {
      document.getElementById("login-password-error").textContent = "Password is required";
      hasError = true;
    }
    
    if (hasError) return;
    
    // Show loading state
    setLoadingState(true, loginSubmitBtn, loginLoader);
    
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Login request failed");
      }
      
      // Success! Show banner and redirect
      showAlert("Authorization successful! Accessing Nexus...", "success");
      
      // Store flag for remember me (just client-side preference)
      if (document.getElementById("login-remember-checkbox").checked) {
        localStorage.setItem("rememberUserEmail", email);
      } else {
        localStorage.removeItem("rememberUserEmail");
      }
      
      // Smooth redirect
      setTimeout(() => {
        window.location.href = "/dashboard.html";
      }, 1500);
      
    } catch (err) {
      showAlert(err.message, "error");
      setLoadingState(false, loginSubmitBtn, loginLoader);
    }
  });

  // Register Submit
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();
    hideAlert();
    
    const firstName = registerFirstNameInput.value.trim();
    const lastName = registerLastNameInput.value.trim();
    const email = registerEmailInput.value.trim();
    const password = registerPasswordInput.value;
    const termsChecked = registerTermsCheckbox.checked;
    
    let hasError = false;
    
    if (!firstName) {
      document.getElementById("register-first-name-error").textContent = "First name is required";
      hasError = true;
    }
    
    if (!lastName) {
      document.getElementById("register-last-name-error").textContent = "Last name is required";
      hasError = true;
    }
    
    if (!email) {
      document.getElementById("register-email-error").textContent = "Email is required";
      hasError = true;
    } else if (!validateEmail(email)) {
      document.getElementById("register-email-error").textContent = "Enter a valid email address";
      hasError = true;
    }
    
    if (!password) {
      document.getElementById("register-password-error").textContent = "Password is required";
      hasError = true;
    } else if (password.length < 6) {
      document.getElementById("register-password-error").textContent = "Password must be at least 6 characters";
      hasError = true;
    }
    
    if (!termsChecked) {
      document.getElementById("register-terms-error").textContent = "You must agree to local terms";
      hasError = true;
    }
    
    if (hasError) return;
    
    // Show loading state
    setLoadingState(true, registerSubmitBtn, registerLoader);
    
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Registration request failed");
      }
      
      // Success! Update view to login
      showAlert("Registration completed! Redirecting to login...", "success");
      
      setTimeout(() => {
        // Pre-fill login email
        loginEmailInput.value = email;
        // Trigger switch
        goToLoginBtn.click();
        // Clear registration form fields
        registerForm.reset();
        updateStrengthBar(0);
        setLoadingState(false, registerSubmitBtn, registerLoader);
      }, 2000);
      
    } catch (err) {
      showAlert(err.message, "error");
      setLoadingState(false, registerSubmitBtn, registerLoader);
    }
  });

  // Loading UI Utility
  function setLoadingState(isLoading, buttonEl, loaderEl) {
    if (isLoading) {
      buttonEl.disabled = true;
      loaderEl.classList.remove("hidden");
      buttonEl.style.opacity = "0.8";
    } else {
      buttonEl.disabled = false;
      loaderEl.classList.add("hidden");
      buttonEl.style.opacity = "1";
    }
  }

  // Pre-fill email if remembered
  const savedEmail = localStorage.getItem("rememberUserEmail");
  if (savedEmail) {
    loginEmailInput.value = savedEmail;
    document.getElementById("login-remember-checkbox").checked = true;
  }
});
