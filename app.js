
'use strict';

const haversine = require('./haversine')

const express = require('express');

const app = express();

var request = require('request');

var url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson";

var firebase = require('firebase-admin');

var serviceAccount = require("./serviceAccountKey.json");

const Nexmo = require('nexmo')

const nexmo = new Nexmo({
  apiKey: "a6fe0f08",
  apiSecret: "802cf5f8dde080d3"
})

firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: 'https://earthquakerescue-dd410.firebaseio.com'
});

function getDateTime() {

    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + ":" + month + ":" + day + ":" + hour + ":" + min + ":" + sec;

}

app.get('/', (req, res) => {
  var date_time = getDateTime();
  res.status(200).send('Hello anand!\n The time : ' + date_time).end();

});

var time = 0;

setInterval(function(){
  //time += 2;
  //console.log(time+' seconds have passed');
  request({
    url : url,
    json : true
  },function(error, response, body){
	var newString = JSON.stringify(body, null, 0);
	var obj = JSON.parse(newString);
	var count = obj.features.length;
  var db = firebase.database();
  var eqcount = db.ref("eqcount");
  eqcount.set(count);


	for(var i = 0; i < count; i++){

			console.log('---------------------------------');
			//console.log(obj.features[i].properties.title);
			//console.log('Magnitude : ',obj.features[i].properties.mag);
      var title = obj.features[i].properties.title;
      var mag = obj.features[i].properties.mag;
			var date = new Date(obj.features[i].properties.time);
      var edate = date.toString("MMM dd");
			//console.log('Date : ',date.toString("MMM dd"));
			var longitude, latitude;
			//console.log('Coordinates : ',obj.features[i].geometry.coordinates);
			longitude = obj.features[i].geometry.coordinates[0];
			latitude = obj.features[i].geometry.coordinates[1];
			//console.log('Latitude : ', latitude, " Longitude : ",longitude);
      var db = firebase.database();

      var eqref = db.ref("earthquake"+i);

      eqref.set({"title":title,"date":edate,"latitude":latitude,"longitude":longitude,"magnitude":mag, "victims" : ""});
      console.log("Updated db - " + title + " " + edate);

      checkUser("earthquake"+i, latitude, longitude, title);

	}


  });
},30000)

function checkUser(earthquake, elatitude, elongitude, title){
  var db = firebase.database();
  var reglistref = db.ref("reglist");
  reglistref.once("value", function(snapshot){
    var phlist = snapshot.val();
    var reglist = phlist.split(" ");
    for(var i = 0; i < reglist.length; i++){
      //console.log(reglist[i]);

      var userref = db.ref(reglist[i]);
      var phonenumber_user = reglist[i];
      var latituderef = userref.child("latitude");
      var longituderef = userref.child("longitude");
      latituderef.once("value", function(snapshot){
        var latitude = snapshot.val();
        longituderef.once("value", function(snapshot){
          var longitude = snapshot.val();
          //console.log("test - "+latitude+ longitude);
          var usersafety = userref.child("safe")
          usersafety.once("value", function(snapshot){
            var safe = snapshot.val();
            const start = {
              latitude: latitude,
              longitude: longitude
            }

            const end = {
              latitude: elatitude,
              longitude: elongitude
            }
            if(haversine(start, end, {threshold: 4.5, unit: 'km'})){
              /*var earthquakeref1 = db.ref(earthquake).child("victims");
			  var eref = db.ref(earthquake);
			  var addedref = userref.child("added");
				  addedref.once('value', function(snapshot){
					  var added = snapshot.val();
					  if(added==false){
						  earthquakeref1.on('value', function(snapshot){
							 var elist = ""; 
							 elist = snapshot.val(); 
					
							 elist = elist + " " + phonenumber_user;
							 //earthquakeref1.update(elist); 
							 eref.update({"victims" : elist});
							 //userref.update({"added" : true});
						  });
					  }
				  });*/
			  
              if(safe){
                userref.update({"earthquake" : title, "safe" : false,"eqid" : earthquake, "added" : true});
              }
              var sentsms = userref.child("sentsms");
              sentsms.once("value", function(snapshot){
                var smsbool = snapshot.val();
                if(smsbool==false){
                  var econtactref = userref.child("econtact");
                  econtactref.once("value", function(snapshot){
                    var econtact = snapshot.val();
                    var usernameref = userref.child("name");
                    usernameref.once("value", function(snapshot){
                      var victimname = snapshot.val();
                      sendSMSto(econtact, victimname, title, phonenumber_user);
                    });
                  });
                }
              });
            }
          });

        });

      });

    }
  });
}

function sendSMSto(phonenumber, name, eq, userphone){
  var message = "Emergency Message!!  "+ name + " was last located in an earthquake affected area. Details : " + eq;
  nexmo.message.sendSms('EarthquakeRescue', phonenumber, message);
  var db = firebase.database();
  var userref = db.ref(userphone);
  userref.update({"sentsms" : true});
  console.log(userphone);

}


// Start the server
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
  var db = firebase.database();
  var ref = db.ref("value");

// Attach an asynchronous callback to read the data at our posts reference
  ref.on("value", function(snapshot) {
  console.log(snapshot.val());
  }, function (errorObject) {
   console.log("The read failed: " + errorObject.code);
});
  ref.set(9999);

});
// [END app]
