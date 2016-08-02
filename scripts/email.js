var nodemailer        = require('nodemailer');
var path              = require('path')
var mongoose = require('mongoose')
, Schema = mongoose.Schema;

var constants         = require('../scripts/constants');
var config            = require(path.join(constants.paths.config, '/config'));
var logger      			= require(constants.paths.scripts +  '/logger');
var weather			      = require(constants.paths.scripts +  '/weather');
var pathBuilder			  = require(constants.paths.scripts +  '/pathBuilder');
var groupService      = require(constants.paths.services +  '/groups');
var visitService     = require(constants.paths.services + '/visits');
var modelVisit        = require(constants.paths.models +  '/visit');
var modelschedule   = require(constants.paths.models +  '/visitSchedule');

var smptOptions       = config.get("email.smtp-options");
var transporter       = nodemailer.createTransport(smptOptions);
var emailTemplate     = require('email-templates').EmailTemplate;
var htmlToText = require('html-to-text');
var Q               = require('q');

var email = {}

email.newUserAdd 								= newUserAdd;
email.notifyNewVisit 						= notifyNewVisit;
email.notifyVisitOwnerChange 		= notifyVisitOwnerChange;
email.welcomeClient 						= welcomeClient;
email.inviteAttendees 					= inviteAttendees;
email.rejectVisitByAdmin 				= rejectVisitByAdmin;
email.newvManagerAssigned				= newvManagerAssigned;
email.newsecvManagerAssigned 			= newsecvManagerAssigned;
email.agendaFinalize					= agendaFinalize;
email.visitClosure 						= visitClosure;
email.getAgenda 						= getAgenda;

module.exports = email;

  // send user registration notification
function newUserAdd(user) {
  if(config.get('email.send-mails')!="true") return;

  var templateDir = path.join(constants.paths.templates, 'email', 'register');
  var registerMail = new emailTemplate(templateDir);

  registerMail.render(user, function (err, results) {

    if(err){
      return console.log(err);
    }

    var emailId = user.email;

    var mailOptions = {
        from: config.get('email.from'),
        to: emailId, // list of receivers
        subject: 'User registration activation', // Subject line
        text: results.text, // plaintext body
        html: results.html // html body
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, function(error, info){
      if(error){
          return console.log(error);
      }
      console.log('Message sent: ' + info.response);

    });
  }); // end of register mail render
} // end of sendMailOnRegistration

function notifyNewVisit(visitId,basePath) {
	if(config.get('email.send-mails')!="true") return;

	var templateDir = path.join(constants.paths.templates, 'email', 'newVisit');
	var mailTemplate = new emailTemplate(templateDir);
	modelVisit
	.findOne({ _id: visitId })
	.populate('client')
	.populate('createBy')
	.populate('visitors.visitor')
	.populate({path:'cscPersonnel.salesExec'})
	.populate({path:'cscPersonnel.accountGM'})
	.populate({path:'cscPersonnel.industryExec'})
	.populate({path:'cscPersonnel.globalDelivery'})
	.populate({path:'cscPersonnel.cre'})
	.exec(function (err, visit) {
		if(err) {
			console.log(err);
		}
		else{
			sendMail(visit)
		}
	})

	function sendMail(visit){
				var visitData =	{
					client: visit.client,
					visitId:visit.id,
					createBy:visit.createBy,
					hostPath: basePath,
					loginPath: pathBuilder.getPath(basePath, "/m"),
					startDate:visit.startDate,
					endDate:visit.endDate,
					locations:visit.locations
				};
				mailTemplate.render(visitData, function (err, results) {

					if(err){
						return console.log(err);
					}

					var emailIds = [];
					var cscPersonnelIds = [];

					if(visit.cscPersonnel.salesExec != null || visit.cscPersonnel.salesExec != undefined)
					{
						cscPersonnelIds.push(visit.cscPersonnel.salesExec.email);
					}

					if(visit.cscPersonnel.salesExec == null || visit.cscPersonnel.salesExec == undefined)
					{
						cscPersonnelIds.push(null);
					}

					if(visit.cscPersonnel.accountGM != null || visit.cscPersonnel.accountGM != undefined)
					{	
						cscPersonnelIds.push(visit.cscPersonnel.accountGM.email);
					}

					if(visit.cscPersonnel.accountGM == null || visit.cscPersonnel.accountGM == undefined)
					{
						cscPersonnelIds.push(null);
					}

					if(visit.cscPersonnel.industryExec != null || visit.cscPersonnel.industryExec != undefined)
					{	
						cscPersonnelIds.push(visit.cscPersonnel.industryExec.email);
					}

					if(visit.cscPersonnel.industryExec == null || visit.cscPersonnel.industryExec == undefined)
					{
						cscPersonnelIds.push(null);
					}

					if(visit.cscPersonnel.globalDelivery != null || visit.cscPersonnel.globalDelivery != undefined)
					{	
						cscPersonnelIds.push(visit.cscPersonnel.globalDelivery.email);
					}

					if(visit.cscPersonnel.globalDelivery == null || visit.cscPersonnel.globalDelivery == undefined)
					{
						cscPersonnelIds.push(null);
					}

					if(visit.cscPersonnel.cre != null || visit.cscPersonnel.cre != undefined)
					{	
						cscPersonnelIds.push(visit.cscPersonnel.cre.email);
					} 

					if(visit.cscPersonnel.cre == null || visit.cscPersonnel.cre == undefined)
					{
						cscPersonnelIds.push(null);
					}

					cscPersonnelIds.push(visit.createBy.email);
					groupService.getUsersByGroup("admin")
					.then(function(users){
						users.forEach(function(user){
							emailIds.push(user.email);
						});
						console.log(emailIds);
						console.log(cscPersonnelIds)
						var mailOptions = {
							from: config.get('email.from'),
								to: emailIds, // list of receivers
								cc: cscPersonnelIds,
								subject: 'New Customer Visit Initiated', // Subject line
								text: results.text, // plaintext body
								html: results.html // html body
							};

						// send mail with defined transport object
						transporter.sendMail(mailOptions, function(error, info){
							if(error){
								return console.log(error);
							}
							console.log('Send mail:: New Visit Initiated - Status: ' + info.response);
							console.log('Notifications sent to ' + emailIds);
							console.log('Notifications sent to ' + cscPersonnelIds);
						}); // end of transporter.sendMail

	   					}); // end of getUsersByGroup service call
			}); // end of register mail render
	}
} // end of sendMailOnRegistration

function notifyVisitOwnerChange(visitId,oldvmanEmail) 
{
	if(config.get('email.send-mails')!="true") return;

	modelVisit
		.findOne({ _id: visitId })
		.populate('client')
		.populate('createBy')
		.populate('anchor')
		.populate('secondaryVmanager')
		.exec(function (err, visit) {
			if(err) {
				console.log(err);
			}
			else{
				sendMail(visit)
			}
		})

		function sendMail(visit){
			var templateDir = path.join(constants.paths.templates, 'email', 'notifyVisitOwnerChange');
			var mailTemplate = new emailTemplate(templateDir);

			mailTemplate.render(visit, function (err, results) {

				if(err){
					return console.log(err);
				}

				var emailIds = [];
				var receiversId = [];
				receiversId.push(visit.createBy.email);
				emailIds.push(oldvmanEmail);
				emailIds.push(visit.anchor.email);

				if(visit.secondaryVmanager != null || visit.secondaryVmanager != undefined)
				{
					emailIds.push(visit.secondaryVmanager.email);
				}

				if(visit.secondaryVmanager == null || visit.secondaryVmanager == undefined)
				{
					emailIds.push(null);
				}

				groupService.getUsersByGroup("admin")
				.then(function(users){
					users.forEach(function(user){
						emailIds.push(user.email);
					});

						var mailOptions = {
								from: config.get('email.from'),
								to: receiversId, // list of receivers
								cc: emailIds,
								subject: 'New Customer Visit Assigned - Visit Manager Changed', // Subject line
								text: results.text, // plaintext body
								html: results.html // html body
						};

						// send mail with defined transport object
						transporter.sendMail(mailOptions, function(error, info){
							if(error){
									return console.log(error);
							}
							console.log('Send mail:: Notify Visit Manager change - Status: ' + info.response);
							console.log('Notifications sent to ' + emailIds);
							console.log('Notifications sent to ' + receiversId);
						}); // end of transporter.sendMail

					}); // end of getUsersByGroup service call
			}); // end of register mail render
		} // end of sendMail
} // end of sendMailOnRegistration

function welcomeClient(visitId, basePath) {
	if(config.get('email.send-mails')!="true") return;

	var templateDir = path.join(constants.paths.templates, 'email', 'welcomeClient');
	var mailTemplate = new emailTemplate(templateDir);

	modelVisit
		.findOne({ _id: visitId })
		.populate('anchor')
		.populate('client')
		.populate('visitors.visitor')
		.exec(function (err, visit) {
			if(err) {
				console.log(err);
			}
			else{
				var weatherSch = weather.getWeatherForSchedule(visit.schedule);
				visit.visitors.forEach(function(participant){
					var visitor = {
						name: participant.visitor.name,
						email: participant.visitor.email,
						visitorId:participant.visitor.id,
						schedule: weatherSch,
						localData:participant.visitor.local,
						spoc: visit.anchor,
						hostPath: basePath,
						loginPath: pathBuilder.getPath(basePath, "loginPage")
					};

					mailTemplate.render(visitor, function (err, results) {

						if(err){
							return console.log(err);
						}

						var mailOptions = {
								from: config.get('email.from'),
								to: visitor.email, // list of receivers
								subject: 'Welcome to CSC', // Subject line
								text: results.text, // plaintext body
								html: results.html // html body
						};

						// send mail with defined transport object
						transporter.sendMail(mailOptions, function(error, info){
							if(error){
									return console.log(error);
							}
							console.log('Send Mail:: WelcomeClient ' + visitor.email + " -- Status: "+ info.response);
						}); // end of transporter.sendMail
					}); // end of register mail render
				}) // end of visitors loop
			} // end of model else
		}); // end of visit model
} // end of welcomeClient


function inviteAttendees(visitId, basePath){

	if(config.get('email.send-mails')!="true") return;

	var templateDir = path.join(constants.paths.templates, 'email', 'inviteAttendees');
	var mailTemplate = new emailTemplate(templateDir);

	modelVisit
		.findOne({ _id: visitId })
		.populate('client')
		.exec(function (err, visit) {
			if(err) {
				console.log(err);
			}
			else{
				console.log(visit);

				visitService.getParticipantsById(visitId)
			    .then(function(participants){
							var emailIds = [];
		          participants["employees"].forEach(function(p){
								emailIds.push(p.email);
							});

							console.log(emailIds);

							mailTemplate.render(visit, function (err, results) {

								if(err){
									return console.log(err);
								}

								var mailOptions = {
										from: config.get('email.from'),
										to: emailIds, // list of receivers
										subject: 'Save your day', // Subject line
										text: results.text, // plaintext body
										html: results.html // html body
								};

								console.log(mailOptions);
								// send mail with defined transport object
								transporter.sendMail(mailOptions, function(error, info){
									if(error){
											return console.log(error);
									}
									console.log("Send Mail:: inviteAttendees  -- Status: "+ info.response);
									console.log('Notifications sent to ' + emailIds);
								}); // end of transporter.sendMail
							}); // end of register mail render
						}); // end of visitService.getParticipantsById
				} //end of else
		}) // end of modelVisit
} // end of inviteAttendees

//Send Notification on Rejection of Visit by Admin to Visit Initiator
function rejectVisitByAdmin(visitId)
{
	if(config.get('email.send-mails')!="true") return;

	var templateDir = path.join(constants.paths.templates, 'email', 'rejectVisitByAdmin');
	var mailTemplate = new emailTemplate(templateDir);

	modelVisit
	.findOne({ _id: visitId })
	.populate('createBy')
	.exec(function (err, visit) {
		if(err) {
			console.log(err);
		}
		else{
			console.log(visit);

			var emailIds = [];
			groupService.getUsersByGroup("admin")
			.then(function(users){
				users.forEach(function(user){
					emailIds.push(user.email);
				});
				console.log(emailIds);
				// var data = 'Hi <b>'+visit.createBy.name.first+ " "+ visit.createBy.name.last+'</b>,\n';
				// data+= '<p>The client visit initiated by you has been rejected and referred back by the Admin. Please review the rejection comments, make necessary changes in the initiation form and re-submit.</p>\n';
				// data+='<p>Rejection comment by admin:'+ visit.rejectReason +'</p>\n';
				// data+='<p>For any questions, please reply to this e-mail.</p>\n';
				// data+='<p>Thanks.<br>CSC India Visit Management Team<br>Connect with us at: Link to C3 page</p><hr/>\n'
				mailTemplate.render(visit, function (err, results) {
					console.log(results);
					// console.log(data);
					if(err){
						return console.log(err);
					}

					var mailOptions = {
						from: config.get('email.from'),
						to: visit.createBy.email, // list of receivers
						cc: emailIds,
						subject: 'Visit Acknowledgement - Rejected', // Subject line
						text: htmlToText.fromString(results.text), // plaintext body
						html: htmlToText.fromString(results.html) // html body
					};

					console.log(mailOptions);
					// send mail with defined transport object
					transporter.sendMail(mailOptions, function(error, info){
						if(error){
							return console.log(error);
						}
							console.log("Send Mail:: rejectVisitByAdmin  -- Status: "+ info.response);
							console.log('Notifications sent to ' + visit.createBy.email);
							console.log('Notifications sent to ' + emailIds);
								}); // end of transporter.sendMail
							}); // end of register mail render
						}); // end of visitService.getParticipantsById
				} //end of else
		}) // end of modelVisit
}

// Send Notification whenever new visit manager(primary vman) is assigned for visit
function newvManagerAssigned(visitId)
{
	if(config.get('email.send-mails')!="true") return;

	var templateDir = path.join(constants.paths.templates, 'email', 'newvManagerAssigned');
	var mailTemplate = new emailTemplate(templateDir);

	modelVisit
	.findOne({ _id: visitId })
	.populate('createBy')
	.populate('client')
	.populate('anchor')
	.populate('secondaryVmanager')
	.populate({path:'cscPersonnel.salesExec'})
	.populate({path:'cscPersonnel.accountGM'})
	.populate({path:'cscPersonnel.industryExec'})
	.populate({path:'cscPersonnel.globalDelivery'})
	.populate({path:'cscPersonnel.cre'})
	.exec(function (err, visit) {
		if(err) {
			console.log(err);
		}
		else{
			console.log(visit);

			var emailIds = [];
			var receiversEmailIds = [];

			visitService.getRegionsHeads(visitId)
			.then(function(regHead)
			{
				emailIds.push(regHead);
			});

			visitService.getOfferingsHeads(visitId)
			.then(function(offHeads){
				for(var i=0;i<offHeads.length;i++)
				{
					emailIds.push(offHeads[i]);
				}
				receiversEmailIds.push(visit.createBy.email);
				receiversEmailIds.push(visit.anchor.email);

				if(visit.secondaryVmanager != null || visit.secondaryVmanager != undefined)
				{
					receiversEmailIds.push(visit.secondaryVmanager.email);
				}

				if(visit.secondaryVmanager == null || visit.secondaryVmanager == undefined)
				{
					receiversEmailIds.push(null);
				}

				if(visit.cscPersonnel.salesExec != null || visit.cscPersonnel.salesExec != undefined)
				{
					emailIds.push(visit.cscPersonnel.salesExec.email);
				}

				if(visit.cscPersonnel.salesExec == null || visit.cscPersonnel.salesExec == undefined)
				{
					emailIds.push(null);
				}

				if(visit.cscPersonnel.accountGM != null || visit.cscPersonnel.accountGM != undefined)
				{	
					emailIds.push(visit.cscPersonnel.accountGM.email);
				}

				if(visit.cscPersonnel.accountGM == null || visit.cscPersonnel.accountGM == undefined)
				{
					emailIds.push(null);
				}

				if(visit.cscPersonnel.industryExec != null || visit.cscPersonnel.industryExec != undefined)
				{	
					emailIds.push(visit.cscPersonnel.industryExec.email);
				}

				if(visit.cscPersonnel.industryExec == null || visit.cscPersonnel.industryExec == undefined)
				{
					emailIds.push(null);
				}

				if(visit.cscPersonnel.globalDelivery != null || visit.cscPersonnel.globalDelivery != undefined)
				{	
					emailIds.push(visit.cscPersonnel.globalDelivery.email);
				}

				if(visit.cscPersonnel.globalDelivery == null || visit.cscPersonnel.globalDelivery == undefined)
				{
					emailIds.push(null);
				}

				if(visit.cscPersonnel.cre != null || visit.cscPersonnel.cre != undefined)
				{	
					emailIds.push(visit.cscPersonnel.cre.email);
				} 

				if(visit.cscPersonnel.cre == null || visit.cscPersonnel.cre == undefined)
				{
					emailIds.push(null);
				}

				groupService.getUsersByGroup("admin")
				.then(function(users){
					users.forEach(function(user){
						emailIds.push(user.email);
					});
					console.log(emailIds);

					mailTemplate.render(visit, function (err, results) {

						if(err){
							return console.log(err);
						}

						var mailOptions = {
							from: config.get('email.from'),
						to: receiversEmailIds, // list of receivers
						cc: emailIds,
						subject: 'Visit Acknowledgement - Accepted', // Subject line
						text: results.text, // plaintext body
						html: results.html // html body
					};

					console.log(mailOptions);
					// send mail with defined transport object
					transporter.sendMail(mailOptions, function(error, info){
						if(error){
							return console.log(error);
						}
						console.log("Send Mail:: visitAcknowledgeAccepted  -- Status: "+ info.response);
						console.log('Notifications sent to ' + receiversEmailIds);
						console.log('Notifications sent to ' + emailIds);
								}); // end of transporter.sendMail
							}); // end of register mail render
						}); // end of visitService.getParticipantsById
					});
				} //end of else
		}) // end of modelVisit
}

// Send Notification whenever new visit manager(secondary vman) is assigned for visit
function newsecvManagerAssigned(visitId)
{
	if(config.get('email.send-mails')!="true") return;

	var templateDir = path.join(constants.paths.templates, 'email', 'newsecvManagerAssigned');
	var mailTemplate = new emailTemplate(templateDir);

	modelVisit
	.findOne({ _id: visitId })
	.populate('createBy')
	.populate('client')
	.populate('anchor')
	.populate('secondaryVmanager')
	.populate({path:'cscPersonnel.salesExec'})
	.populate({path:'cscPersonnel.accountGM'})
	.populate({path:'cscPersonnel.industryExec'})
	.populate({path:'cscPersonnel.globalDelivery'})
	.populate({path:'cscPersonnel.cre'})
	.exec(function (err, visit) {
		if(err) {
			console.log(err);
		}
		else{
			console.log(visit);

			var emailIds = [];
			var receiversEmailIds = [];

			receiversEmailIds.push(visit.createBy.email);
			receiversEmailIds.push(visit.anchor.email);
			receiversEmailIds.push(visit.secondaryVmanager.email);	
			if(visit.cscPersonnel.salesExec != null || visit.cscPersonnel.salesExec != undefined)
			{
				emailIds.push(visit.cscPersonnel.salesExec.email);
			}

			if(visit.cscPersonnel.salesExec == null || visit.cscPersonnel.salesExec == undefined)
			{
				emailIds.push(null);
			}

			if(visit.cscPersonnel.accountGM != null || visit.cscPersonnel.accountGM != undefined)
			{	
				emailIds.push(visit.cscPersonnel.accountGM.email);
			}

			if(visit.cscPersonnel.accountGM == null || visit.cscPersonnel.accountGM == undefined)
			{
				emailIds.push(null);
			}

			if(visit.cscPersonnel.industryExec != null || visit.cscPersonnel.industryExec != undefined)
			{	
				emailIds.push(visit.cscPersonnel.industryExec.email);
			}

			if(visit.cscPersonnel.industryExec == null || visit.cscPersonnel.industryExec == undefined)
			{
				emailIds.push(null);
			}

			if(visit.cscPersonnel.globalDelivery != null || visit.cscPersonnel.globalDelivery != undefined)
			{	
				emailIds.push(visit.cscPersonnel.globalDelivery.email);
			}

			if(visit.cscPersonnel.globalDelivery == null || visit.cscPersonnel.globalDelivery == undefined)
			{
				emailIds.push(null);
			}

			if(visit.cscPersonnel.cre != null || visit.cscPersonnel.cre != undefined)
			{	
				emailIds.push(visit.cscPersonnel.cre.email);
			} 

			if(visit.cscPersonnel.cre == null || visit.cscPersonnel.cre == undefined)
			{
				emailIds.push(null);
			}

			groupService.getUsersByGroup("admin")
			.then(function(users){
				users.forEach(function(user){
					emailIds.push(user.email);
				});
				console.log(emailIds);

				mailTemplate.render(visit, function (err, results) {

					if(err){
						return console.log(err);
					}

					var mailOptions = {
						from: config.get('email.from'),
						to: receiversEmailIds, // list of receivers
						cc: emailIds,
						subject: 'Visit Acknowledgement - Accepted', // Subject line
						text: results.text, // plaintext body
						html: results.html // html body
					};

					console.log(mailOptions);
					// send mail with defined transport object
					transporter.sendMail(mailOptions, function(error, info){
						if(error){
							return console.log(error);
						}
							console.log("Send Mail:: visitAcknowledgeAccepted  -- Status: "+ info.response);
							console.log('Notifications sent to ' + receiversEmailIds);
							console.log('Notifications sent to ' + emailIds);
								}); // end of transporter.sendMail
							}); // end of register mail render
						}); // end of visitService.getParticipantsById
				} //end of else
		}) // end of modelVisit
}

// Send Notification when visit is closed
function visitClosure(visitId,basePath) {

	if(config.get('email.send-mails')!="true") return;

	var templateDir = path.join(constants.paths.templates, 'email', 'visitClosure');
	var mailTemplate = new emailTemplate(templateDir);

	modelVisit
	.findOne({ _id: visitId })
	.populate('client')
	.populate('createBy')
	.populate('anchor')
	.exec(function (err, visit) {
		if(err) {
			console.log(err);
		}
		else{
			console.log(visit);
			if(visit.client.name == visit.client.subName)
			{
				var subject = visit.client.name + "  visit - Closure submitted"
			}
			if(visit.client.name != visit.client.subName)
			{
				var subject = visit.client.name + " "+ visit.client.subName + "  visit - Closure submitted"
			}
			var emailIds = [];
			var receiversEmailIds = [];
			visitService.getRegionsHeads(visitId)
			.then(function(regHead)
			{
				emailIds.push(regHead);
			});

			visitService.getOfferingsHeads(visitId)
			.then(function(offHeads){
				for(var i=0;i<offHeads.length;i++)
				{
					emailIds.push(offHeads[i]);
				}
			visitService.getParticipantsById(visitId)
			.then(function(participants){
				receiversEmailIds.push(visit.anchor.email);
				
				groupService.getUsersByGroup("admin")
				.then(function(users){
					users.forEach(function(user){
						receiversEmailIds.push(user.email);
					});
				});

				console.log(receiversEmailIds);

				participants["employees"].forEach(function(p){
					emailIds.push(p.email);
				});

				participants["clients"].forEach(function(c){
					emailIds.push(c.email);
				});

				emailIds.push(visit.createBy.email);

				console.log(emailIds);
				var visitData =	{
					client: visit.client,
					visitId:visit.id,
					createBy:visit.createBy,
					hostPath: basePath,
					loginPath: pathBuilder.getPath(basePath, "loginPage")
				};
				mailTemplate.render(visitData, function (err, results) {

					if(err){
						return console.log(err);
					}

					var mailOptions = {
						from: config.get('email.from'),
										to: emailIds, // list of receivers
										cc: receiversEmailIds,
										subject: subject, // Subject line
										text: results.text, // plaintext body
										html: results.html, // html body
									};

									console.log(mailOptions);
								// send mail with defined transport object
								transporter.sendMail(mailOptions, function(error, info){
									if(error){
										return console.log(error);
									}
									console.log("Send Mail:: visitClosure  -- Status: "+ info.response);
									console.log('Notifications sent to ' + emailIds);
								}); // end of transporter.sendMail
							}); // end of register mail render
						}); // end of visitService.getParticipantsById
					});
				} //end of else
		}) // end of modelVisit
}

// code to generate pdf file for visit schedules//
function getAgenda(visitId,basePath){
	var deferred = Q.defer();
	if(config.get('email.send-mails')!="true") return;
	modelschedule
		.findOne({ visit: visitId })
		.populate('invitees')
		.populate('session.owner')
		.exec(function (err, visit) {
			if(err) {
				console.log(err);
			}
			else{
				visitService.getPDFSessionsById(visitId)
				.then(function(vSchedules){
					var text = 'Agenda:';
					 for (var i = 0; i < vSchedules.length; i++) {
						text += "<label><b> "+ (vSchedules[i].date).format('ddd, DD MMM YYYY')+" | CSC "+vSchedules[i].location+"</b></label>";
						text += "<table border=1 cellpadding=0 cellspacing=0 width=100%><tr><th width=15%>Type</th><th width=20%>Time (Hrs.)</th><th width=20%>Session/Activity</th><th width=20%>Anchors</th><th width=20%>Venue</th></tr>";
						for (var j = 0; j < vSchedules[i].sessions.length; j++) {
							text += "<tr><td>"+vSchedules[i].sessions[j].session.type+"</td>";
							text += "<td>"+(vSchedules[i].sessions[j].session.startTime).toLocaleString()+"-"+(vSchedules[i].sessions[j].session.endTime).toLocaleString()+"</td>";
							if(vSchedules[i].sessions[j].session.title != null)
								text += "<td>"+vSchedules[i].sessions[j].session.title+"</td>";
							else
								text += "<td colspan=2 align=center>"+vSchedules[i].sessions[j].session.type+"</td>";

							if(vSchedules[i].sessions[j].session.title != null){
								if (vSchedules[i].sessions[j].session.owner != null) {
									ownerName = vSchedules[i].sessions[j].session.owner.name.first+" "+vSchedules[i].sessions[j].session.owner.name.last+", ";
								}else
									ownerName = '';
								text += "<td><b>"+ownerName+"</b>";
								for (var k = 0; k < vSchedules[i].sessions[j].invitees.length; k++) {
									text += vSchedules[i].sessions[j].invitees[k].name.first+' '+vSchedules[i].sessions[j].invitees[k].name.last+", ";
								}
								text += "</td>";
							}

							text += "<td>"+vSchedules[i].sessions[j].session.location+"</td></tr>";
				        }
				        text += "</table>";
				    }
				    var fs = require('fs');
					fs.writeFile("pdfAgenda1.html", text);
					setTimeout(function(){
						var pdf = require('html-pdf');
						var options = { format: 'Letter' };
						var html = fs.readFileSync('pdfAgenda1.html', 'utf8');
						pdf.create(html, options).toFile( __dirname + '/../public/uploads/visits/'+'pdfAgenda1.pdf', function(err, res) {
						  if (err) return console.log(err);
							var destPath = res.filename.split('cViz');
							if (destPath[1]!=null) {
								deferred.resolve(destPath[1]);
								agendaFinalize(visitId,basePath);
							} else {
								deferred.reject('is not allowed.');
							}
							return deferred.promise;
						});
					}, 8000);
				}); // end of visitService.getParticipantsById
				} //end of else
		}) // end of modelVisit
}
// code to generate pdf file for visit schedules//

// Send Notification when visit is finalized
function agendaFinalize(visitId,basePath) {
	if(config.get('email.send-mails')!="true") return;
	var templateDir = path.join(constants.paths.templates, 'email', 'agendaFinalize');
	var mailTemplate = new emailTemplate(templateDir);

	modelVisit
	.findOne({ _id: visitId })
	.populate('client')
	.populate('createBy')
	.populate('anchor')
	.exec(function (err, visit) {
		if(err) {
			console.log(err);
		}
		else{
			console.log(visit);
			if(visit.client.name == visit.client.subName)
			{
				var subject = visit.client.name + "  visit planning - Agenda finazlied"
			}
			if(visit.client.name != visit.client.subName)
			{
				var subject = visit.client.name + " "+ visit.client.subName + " visit planning - Agenda finazlied"
			}
			console.log(subject);
			var emailIds = [];
			var receiversEmailIds = [];
			visitService.getRegionsHeads(visitId)
			.then(function(regHead)
			{
				emailIds.push(regHead);
			});

			visitService.getOfferingsHeads(visitId)
			.then(function(offHeads){
				for(var i=0;i<offHeads.length;i++)
				{
					emailIds.push(offHeads[i]);
				}

			visitService.getParticipantsById(visitId)
			.then(function(participants){

				receiversEmailIds.push(visit.anchor.email);
				
				groupService.getUsersByGroup("admin")
				.then(function(users){
					users.forEach(function(user){
						receiversEmailIds.push(user.email);
					});
				});

				console.log(receiversEmailIds);

				participants["employees"].forEach(function(p){
					emailIds.push(p.email);
				});

				console.log(emailIds);

				mailTemplate.render(visit, function (err, results) {

					console.log(basePath)
					var filePath = basePath + "/public/uploads/visits/pdfAgenda1.pdf";
					// var filePath = basePath + getAgenda(visitId);

					if(err){
						return console.log(err);
					}

					var mailOptions = {
						from: config.get('email.from'),
										to: emailIds, // list of receivers
										cc: receiversEmailIds,
										subject: subject, // Subject line
										text: results.text, // plaintext body
										html: results.html, // html body
										attachments: [{						
											//path: filePath,
											path: filePath,
											contentType: 'application/pdf',
											cache:true
										}]
									};

									console.log(mailOptions);
								// send mail with defined transport object
								transporter.sendMail(mailOptions, function(error, info){
									if(error){
										return console.log(error);
									}
									console.log("Send Mail:: inviteAttendees  -- Status: "+ info.response);
									console.log('Notifications sent to ' + emailIds);
									console.log('Notifications sent to ' + receiversEmailIds);
									transporter.close();
								}); // end of transporter.sendMail

							}); // end of register mail render
						}); // end of visitService.getParticipantsById
					});
				} //end of else
		}) // end of modelVisit
}

// Send Notification when visit is closed
function sessionTimeChange(visitId) {

	if(config.get('email.send-mails')!="true") return;

	var templateDir = path.join(constants.paths.templates, 'email', 'sessionTimeChange');
	var mailTemplate = new emailTemplate(templateDir);

	modelVisit
	.findOne({ _id: visitId })
	.populate('client')
	.populate('createBy')
	.populate('anchor')
	.exec(function (err, visit) {
		if(err) {
			console.log(err);
		}
		else{
			console.log(visit);

			visitService.getParticipantsById(visitId)
			.then(function(participants){
				var emailIds = [];
				var receiversEmailIds = [];
				receiversEmailIds.push(visit.anchor.email);
				
				groupService.getUsersByGroup("admin")
				.then(function(users){
					users.forEach(function(user){
						receiversEmailIds.push(user.email);
					});
				});

				console.log(receiversEmailIds);

				participants["employees"].forEach(function(p){
					emailIds.push(p.email);
				});

				console.log(emailIds);

				mailTemplate.render(visit, function (err, results) {

					if(err){
						return console.log(err);
					}

					var mailOptions = {
						from: config.get('email.from'),
										to: emailIds, // list of receivers
										cc: receiversEmailIds,
										subject: 'Save your day', // Subject line
										text: results.text, // plaintext body
										html: results.html // html body
									};

									console.log(mailOptions);
								// send mail with defined transport object
								transporter.sendMail(mailOptions, function(error, info){
									if(error){
										return console.log(error);
									}
									console.log("Send Mail:: inviteAttendees  -- Status: "+ info.response);
									console.log('Notifications sent to ' + emailIds);
								}); // end of transporter.sendMail
							}); // end of register mail render
						}); // end of visitService.getParticipantsById
				} //end of else
		}) // end of modelVisit
}