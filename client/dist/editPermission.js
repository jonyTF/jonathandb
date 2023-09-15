let endpoint = localStorage.getItem("endpoint");

async function updateUser(data) {
    const response = await fetch(`${endpoint}/UpdateUserPermission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    } 
    const responseData = await response.text();  // Get the response as text
    
    // Log the response to check it
    console.log("Server Response:", responseData);  

    // Only attempt to parse if responseData is not empty
    return responseData ? JSON.parse(responseData) : {}; 
   }

document.addEventListener('DOMContentLoaded', function() {
    // 1. Parse permissions from the URL.
    const urlParams = new URLSearchParams(window.location.search);
    const permissions = JSON.parse(decodeURIComponent(urlParams.get('permissions')));
    for (let key in permissions) {
        let permissionFormHTML = `
            <div id="${key}">
                <label>${key}</label>
                <label>R: <input type="checkbox" name="R"></label>
                <label>W: <input type="checkbox" name="W"></label>
                <label>U: <input type="checkbox" name="U"></label>
                <label>D: <input type="checkbox" name="D"></label>
            </div>
        `;
        document.getElementById("editPermissionsFormContainer").innerHTML += permissionFormHTML;
    }
  
    // 2. Populate the permission checkboxes.
    populatePermissions(permissions);
  
    // 3. Handle form submission to edit permissions.
    document.getElementById('editPermissionForm').addEventListener('submit', async function(e) {
      e.preventDefault();
  
      // Collect updated permissions from the form.
      const updatedPermissions = collectUpdatedPermissions();
      
      let updatedRole = document.getElementById('editUserRole').value;
      let userEmail = localStorage.getItem('userEmail');
      let sessionJwtToken = localStorage.getItem('sessionJwtToken');

      const data = {
        authEmail: userEmail,
        email: document.getElementById('editEmail').value,
        role: updatedRole,
        permissions: updatedPermissions,
        jwtToken: sessionJwtToken
      }

      try {
        console.log(JSON.stringify(data,null,2))
        console.log(endpoint)
        const response = await updateUser(data)
        console.log(response)
        // Maybe close the edit window after successful update
        window.close();
      } catch (error) {
        console.error('Error updating permissions:', error);
      }
    });
  });
  
  function populatePermissions(permissions) {
    for (let key in permissions) {
      let permissionSet = permissions[key];
      let keyDiv = document.getElementById(key);
      
      if (!keyDiv) {
        console.error(`No div found for key: ${key}`);
        continue;
      }
  
      for (let action in permissionSet) {
        let checkbox = keyDiv.querySelector(`input[name=${action}]`);
        
        if (!checkbox) {
          console.error(`No checkbox found for action: ${action} in key: ${key}`);
          continue;
        }
  
        checkbox.checked = permissionSet[action];
      }
    }
  }
  
  function collectUpdatedPermissions() {
    const permissions = {};
  
    // Assuming that each permission key has a corresponding div in the form.
    document.querySelectorAll('#editPermissionsFormContainer > div').forEach(div => {
      const key = div.id;
      permissions[key] = {};
  
      div.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        permissions[key][checkbox.name] = checkbox.checked;
      });
    });
    console.log("updated permissions:" , permissions)
    return permissions;
  }
  