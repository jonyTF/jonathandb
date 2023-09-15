const parentElement = document.getElementById("googleButtonContainer");
const options = {
  type: "standard",
  theme: "filled_blue",
  logo_alignment: "center",
};

window.onload = function () {
  google.accounts.id.initialize({
    client_id: googleClientId,
    callback: handleCredentialResponse,
  });
  google.accounts.id.prompt();
  google.accounts.id.renderButton(parentElement, options);
  document.getElementById("modal").style.display = "none";
};

async function handleCredentialResponse(response) {

  // console.log(response.credential);
  const idToken = response.credential;
  const decoded = jwt_decode(idToken);
  console.log(decoded)
  // console.log(decoded.email)
  userEmail = decoded.email;
  sessionJwtToken = response.credential

  localStorage.setItem('userEmail', userEmail);
  localStorage.setItem('sessionJwtToken', sessionJwtToken);
  localStorage.setItem('endpoint', endpoint);

  // Instead of decoding the JWT on the client side, we send it to the server
  await sendTokenToServer(response);

  // Load rest of website
  // Create the picker buttons when logged in
  const pickerContainer = document.getElementById("picker");
  Object.keys(jsonSchema).forEach((tableName) => {
    const button = document.createElement("button");
    button.id = tableName;
    button.className = "picker-button";
    button.textContent = tableName;
    button.addEventListener("click", () => {
      selectSchema(tableName);
    });
    pickerContainer.appendChild(button);
  });

  // Remove button
  parentElement.remove();

  // Display the first schema by default
  firstTable = Object.keys(jsonSchema)[0];
  console.log("first table name: " + firstTable);
  selectSchema(firstTable);
}

async function sendTokenToServer(req) {
  const tokenInput = req.credential;

  try {
    const response = await fetch(endpoint + "/googleLogin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jwtToken: tokenInput, authEmail: userEmail }),
    });

    // The response object now contains the server response.
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // If we get here, the HTTP response status is 200-299.
    // We need to convert the response to JSON.
    // This also returns a promise, so we use `await` again.
    const userPermissions = await response.json();

    // Now, `userPermissions` contains the JSON response from your server.
    // You can store this in local storage or use it in your application.
    console.log(userPermissions);
    localStorage.setItem('userPermissions', JSON.stringify(userPermissions));
    if (userPermissions.role === 'admin') {
      document.getElementById('adminLink').style.display = 'block';
    } else {
      document.getElementById('adminLink').style.display = 'none';
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

