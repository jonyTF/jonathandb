document.getElementById("displayFormButton").onclick = function() {
  document.getElementById("modal").style.display = 'block';
  const tableName = localStorage.getItem('tableName');
  displayForm(tableName);
}


document.getElementsByClassName('close-button')[0].onclick = function() {
  document.getElementById('modal').style.display = 'none';
};

// Function to handle schema selection
function selectSchema(tableName) {
  const pickerButtons = document.getElementsByClassName('picker-button');
  // Remove the 'selected' class from all buttons
  Array.from(pickerButtons).forEach(button => {
    button.classList.remove('selected');
  });

  localStorage.setItem('tableName', tableName);

  // Add the 'selected' class to the clicked button
  const selectedButton = document.getElementById(tableName);
  selectedButton.classList.add('selected');

  // Call the displayTable function with the selected schema
  renderTable(tableName);
}

// Function to display the form upon website load. Also have load the data already in the database.
function displayForm(tableName) {
    const Form = JSONSchemaForm.default;
    ReactDOM.render(
        React.createElement(Form, {
            key: Date.now(),
            schema: jsonSchema[tableName],
            uiSchema: uiSchema[tableName],
            onSubmit: e => setFormData(e.formData, tableName)
        }),
  document.getElementById("form")
    );
}

// Function to call API POST request upon validation success
async function setFormData(formData, tableName) {
  let userEmail = localStorage.getItem("userEmail");
  let sessionJwtToken= localStorage.getItem("sessionJwtToken");
  
  // Information to send in request body
    const setData = {
      data: formData,
      email: userEmail,
      jwtToken: sessionJwtToken,
      stubName: tableName
    };

    console.log("Tablename: " + tableName);
    console.log("Form data: " + JSON.stringify(formData));

    try {
      const response = await fetch(endpoint + "/uploadData", {
        method: "POST",
        body: JSON.stringify(setData),
        headers: { 'Content-Type': 'application/json;charset=utf-8' }
      });

      const responseData = await response.json();
      console.log("here" + response.ok)

      if (!response.ok) { // If the server responds with an error status code
        // Show the error message on frontend
        const errorMessageElement = document.getElementById("errorMessage"); // Assuming you have an HTML element with the id "errorMessage"
        errorMessageElement.innerText = JSON.stringify(responseData);
        errorMessageElement.style.display = "block"; // Show the error message element
        return;
      }
      console.log(JSON.stringify(responseData));
      await renderTable(tableName);
    } 
    catch (error) {
      console.error('Error:' + JSON.stringify(error));
    }
}

// Function to check file extension
function checkFileExtension(fileStr,extension){
    if (extension == ".") return true;
  
    if(fileStr.includes(extension)){
      console.log("File extension is valid");
        return true;
    }

    console.log("File extension is not valid");
    return false;
  }

