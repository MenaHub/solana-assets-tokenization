// nodemon dependency is used to automatically restart the server after
// every change in the code

//EVERYTHING IS TOP TO BOTTOM

const express = require('express')
const app = express() // create an application which allows us to
    // set up our server

app.use(express.static("public")) // is going to serve all the static file in the public folder
app.use(express.urlencoded({ extended: true })) // express middleware to access information coming from forms
app.use(express.json())
    // to process JSON information and post it into the server like a fetch from the client
        // to the server

//app.use(compression) // decrease the size of the response body and hence increase the speed of a web app

//app.get('/', (res, req) => req.redirect('/building'))

// linking a route to a path mounting the router
// now we can call the methods in the route
app.use('/building', require('./routes/building'))

const port = 3002
app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`)
}) // now we have a server running on port 3002