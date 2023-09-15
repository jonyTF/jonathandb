
async function fetchPermissions() {
  let userEmail = localStorage.getItem('userEmail');
  let sessionJwtToken = localStorage.getItem('sessionJwtToken');
    console.log(userEmail)
    console.log(sessionJwtToken)
    const response = await fetch(`${endpoint}/getAllPermissions?authEmail=${userEmail}&jwtToken=${sessionJwtToken}`); 
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  
    return response.json();
 }

 async function deleteUser(email, e) {
  let userEmail = localStorage.getItem('userEmail');
  let sessionJwtToken = localStorage.getItem('sessionJwtToken');
    const response = await fetch(endpoint + "/deleteUserPermission?authEmail=" + userEmail + "&email=" + email + "&jwtToken=" + sessionJwtToken, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    } else {
      e.target.closest("tr").remove();
    }
  
    return response.json();
 }

 async function createUser(data, email, role, permissions) {
  const response = await fetch(`${endpoint}/CreateUserPermission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  } else {
    var rowHTML = `<tr data-email="${email}">
              <td>${email}</td>
              <td>${role}</td>
              <td>${JSON.stringify(permissions)}</td>
              <td>
                  <button class="editBtn">Edit</button>
                  <button class="deleteBtn">Delete</button>
              </td>
          </tr>`;
          document.getElementById("permissionsTable").querySelector("tbody").innerHTML += rowHTML;
  }
  return response.json(); 
 }


 window.onload = function() {
    // I'm assuming stubs is available globally
    var stubs = Object.keys(jsonSchema);
  
    // Generate permission inputs based on stubs
    stubs.forEach(stub => {
      var permissionFormHTML = `
        <div id="${stub}">
          <label>${stub}</label>
          <label>R: <input type="checkbox" name="R"></label>
          <label>W: <input type="checkbox" name="W"></label>
          <label>U: <input type="checkbox" name="U"></label>
          <label>D: <input type="checkbox" name="D"></label>
        </div>
      `;
      document.getElementById("permissionsFormContainer").innerHTML += permissionFormHTML;
    });
  
    // Fetch and display permissions on page load
    fetchPermissions()
    .then(result => {
      result.forEach(permission => {
        var rowHTML = `<tr data-email="${permission.email}">
          <td>${permission.email}</td>
          <td>${permission.role}</td>
          <td>${JSON.stringify(permission.permissions)}</td>
          <td>
            <button class="editBtn">Edit</button>
            <button class="deleteBtn">Delete</button>
          </td>
        </tr>`;
        document.getElementById("permissionsTable").querySelector("tbody").innerHTML += rowHTML;
      });
    })
    .catch(error => console.error(error));
  
    // Handle form submission
    document.getElementById("userPermissionForm").addEventListener("submit", function(e) {
      e.preventDefault();
  
      var email = document.getElementById("userEmail").value;
      var role = document.getElementById("userRole").value;
      var permissions = {};
  
      stubs.forEach(stub => {
        var permission = {};
        document.getElementById(stub).querySelectorAll("input").forEach(function(input) {
          permission[input.name] = input.checked;
        });
        permissions[stub] = permission;
      });
      let userEmail = localStorage.getItem('userEmail');
      let sessionJwtToken = localStorage.getItem('sessionJwtToken');
      var data = { authEmail: userEmail, role: role, email: email, permissions: permissions, jwtToken: sessionJwtToken };


      createUser(data, email, role, permissions)
      .then(result => {
        console.log(result);
      })
      .catch(error => console.error(error));
    });

    // Handle delete button clicks
    document.getElementById("permissionsTable").addEventListener("click", function(e) {
      if (e.target.className === "deleteBtn") {
        var email = e.target.closest("tr").dataset.email;

        deleteUser(email, e)
        .then(result => console.log(result))
        .catch(error => console.error(error));
      }
      else if (e.target.className === "editBtn") {
        var email = e.target.closest("tr").dataset.email;
        var role = e.target.closest("tr").querySelector("td:nth-child(2)").textContent;
        var permissions = JSON.parse(e.target.closest("tr").querySelector("td:nth-child(3)").textContent);
        var permissionsString = JSON.stringify(permissions);
        var encodedPermissions = encodeURIComponent(permissionsString);
        var encodedRole = encodeURIComponent(role);
        var editWindowURL = 'editPermission.html?permissions=' + encodedPermissions + '&role=' + encodedRole;

        var editWindow = window.open(editWindowURL, 'Edit Permission', 'width=600,height=400');
    
        // Wait for the new window to load, then populate the form
        editWindow.onload = function() {
          this.document.getElementById('editEmail').value = email;
          this.document.getElementById('editUserRole').value = role;
        };
      }

    });
  
 }