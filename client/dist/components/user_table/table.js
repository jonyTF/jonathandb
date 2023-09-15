function constructURL(endpoint, params) {
  const url = new URL(`${endpoint}/getByEmail`);
  url.search = new URLSearchParams(params).toString();
  return url;
}

async function renderTable(tableName) {
  // Reset table
  document.getElementById("getByEmailTable").innerHTML = "";
  let userEmail = localStorage.getItem("userEmail");
  let sessionJwtToken= localStorage.getItem("sessionJwtToken");

  // Information to send in request body
  const getData = {
    email: userEmail,
    jwtToken: sessionJwtToken,
    stubName: tableName,
  };

  // Get table entries from API
  try {
    const url = constructURL(endpoint, getData);
    // const response = await fetch(url);
    console.log("I need endpoint:")
    console.log(endpoint)

    const response = await fetch(`${endpoint}/getByEmail?email=${userEmail}&stubName=${tableName}&jwtToken=${sessionJwtToken}`);
    const responseData = await response.json();
    console.log("I need data:")
    console.log(responseData)
    if (!responseData[0]) {
      console.log("No data returned for this table");
      return;
    }

    // Get the table's corresponding jsonSchema 
    tableSchemaProperties = jsonSchema[tableName].properties;


    // Build the table from the fetched data
    document.getElementById("getByEmailTable").innerHTML = await buildTable(
      responseData,
      tableSchemaProperties
    );
    enableCollapsing();

  } catch (error) {
    console.error("Error fetching data from table: " + error);
    return;
  }
}

// Function that takes data from getByEmail and builds an HTML table
async function buildTable(data, tableSchemaProperties) {
  // console.log("Building table");

  // Get field information from jsonSchemas
  let fields = tableSchemaProperties ? Object.keys(tableSchemaProperties) : [];

  // Append necessary fields to the form
  let tableHtml = `
        <table><tr>
          ${fields.map((field) => `<th>${field}</th>`).join("")}
      `;
  tableHtml += `<th>UID</th><th>Email</th></tr>`;

  // Fill out rows for data
  for (const row of data) {
    tableHtml += "<tr>";
    const rowData = row["data"];
    for (const field of fields) {
      if (!rowData[field]) rowData[field] = "";
      console.log("Row data: " + JSON.stringify(rowData));
      let cellValue = rowData[field];
      let jsonValue = tableSchemaProperties[field];
      let fieldType = tableSchemaProperties[field]["type"];

      // If a property is an object, display it as a collapsible object
      if (fieldType === "object") {
        tableHtml += `<td><div class="collapsible">${field}<div class="content" onclick="event.stopPropagation();">${buildObjectCell(
          cellValue,
          jsonValue
        )}</div></div></td>`;
      }

      // If array, display it as a collpasible objects
      else if (fieldType === "array") {
        let nestedType = jsonValue["items"]["type"];
        tableHtml += `<td><div class="collapsible">${field}<div class="content" onclick="event.stopPropagation();">`;
        for (const i in cellValue) {
          if (i < cellValue.length-1) tableHtml += `<div class="borderDiv">`
          if (nestedType === "string") {
            // console.log(JSON.stringify(jsonValue));
            tableHtml += `<p>${buildStringCell(
              cellValue[i].toString(),
              jsonValue["items"]
            )}</p>`;
          } else if (nestedType === "object") {
            tableHtml += `<p>${buildObjectCell(
              cellValue[i],
              jsonValue["items"]
            )}</p>`;
          }
          // Add border
          if (i < cellValue.length-1) tableHtml += `</div>`;
        }
        tableHtml += "</div></div></td>";
      }
      // If string, display it accordingly
      else if (fieldType === "string" || fieldType === "boolean") {
        // Build string 
        tableHtml += `<td>${buildStringCell(cellValue.toString(), jsonValue)}</td>`;
      } 
      else {
        tableHtml += `<td>${cellValue}</td>`;
      }
    }
    
    // Add event metadata
    tableHtml += `<td>${row.eventId}<br></td>`;
    tableHtml += `<td>${row.email}<br></td>`;
    tableHtml += "</tr>";
  }
  // console.log(tableHtml);

  return tableHtml + "</table>";
}

// Function to build the HTML for object types
function buildObjectCell(cellValue, jsonValue) {
  // console.log("Cell value" + JSON.stringify(cellValue));
  // console.log("jsonVlaue value" + JSON.stringify(jsonValue));

  let fields = jsonValue["properties"];
  let objectHtml = "";
  // console.log(JSON.stringify(fields));

  // Loop through the properties of the object and build it accordingly.
  for (const field in fields) {
    let fieldType = fields[field]["type"];
    objectHtml += `<p>${field}: `;

    if (fieldType === "string" || fieldType === "boolean") {
      objectHtml += buildStringCell(cellValue[field].toString(), fields[field]);
    }

    objectHtml += "</p>";
  }

  return objectHtml;
}

// Function to build the HTML for string types
function buildStringCell(cellValue, jsonValue) {
  let fieldFormat = jsonValue["format"];
  let stringHtml = "";

  // Check if the data is a file (aka signedURL from S3)
  // console.log("cell value: " + JSON.stringify(cellValue));
  if (fieldFormat === "data-url") {
    // Get the file from cellValue (which is presumably a signedURL from AWS)
    const urlObject = new URL(cellValue);
    const pathname = urlObject.pathname;
    const fileName = pathname.substring(pathname.lastIndexOf("/") + 1);
    stringHtml += `<a href="${cellValue}" download>${fileName}</a><br>`;
    stringHtml = `${stringHtml}`;
  } 
  // Check if the data is a URL
  else if (fieldFormat === "uri" || fieldFormat === "uri-reference") {
    stringHtml += `<a href="${cellValue}">${cellValue}</a><br>`;
    stringHtml = `${stringHtml}`;
  }
  // The string is just a standard string 
  else {
    stringHtml += `${cellValue}`;
  }
  return stringHtml;
}


var handleToggle; // IMPORTANT
// This function enables the ability for the nested objects to be collapsed. It must be called everytime a new table is displayed.
function enableCollapsing() {
  var coll = document.getElementsByClassName("collapsible");
  var i;

  for (i = 0; i < coll.length; i++) {
    coll[i].addEventListener("click", function () {
      this.classList.toggle("active");
      var content = this.querySelector(".content");
      if (content.style.maxHeight) {
        content.style.maxHeight = null;
      } else {
        content.style.maxHeight =
          "none"; /* or enough height to show content */
      }
    });
  }
  
  // This defines the function for toggling ALL collapsed views. We need to keep a reference to the old one (handletoggle defined before this function) so that we can remove it.
  var newHandleToggle = function() {
    var allOpen = true;
    for (i = 0; i < coll.length; i++) {
      if (!coll[i].classList.contains("active")) {
        allOpen = false;
        break;
      }
    }
  
    for (i = 0; i < coll.length; i++) {
      var content = coll[i].querySelector(".content");
      if (allOpen) {
        coll[i].classList.remove("active");
        content.style.maxHeight = null;
      } else {
        coll[i].classList.add("active");
        content.style.maxHeight = "none"; /* or enough height to show content */
      }
    }
  };

  // If handleToggle is defined (AKA an EventListener exists on toggleAll), remove it.
  if (handleToggle) {
    document.getElementById("toggleAll").removeEventListener("click", handleToggle); 
  }
  document.getElementById("toggleAll").addEventListener("click", newHandleToggle); 
  handleToggle = newHandleToggle;
}