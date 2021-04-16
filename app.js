//jshint esversion:6

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const _ = require("lodash");
const https = require("https");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const app = express();

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(express.json());

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// -------------------------------------------------
// Database
// -------------------------------------------------

mongoose.connect("mongodb://localhost:27017/platformDB", {useNewUrlParser: true, useUnifiedTopology: true});
mongoose.set("useCreateIndex", true);

const corporatesSchema = new mongoose.Schema({
  name: String,
});

const Corporate = mongoose.model("Corporate", corporatesSchema);

const teamsSchema = new mongoose.Schema({
  name: String,
});

const Team = mongoose.model("Team", teamsSchema);

const usersSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  function: String,
  username: String,
  password: String,
  team: String
});

usersSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User", usersSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const notesSchema = new mongoose.Schema({
  noteTitle: String,
  noteContent: String,
  noteSubject: String
});

const Note = mongoose.model("Note", notesSchema);

const messagesSchema = new mongoose.Schema({
  messageTitle: String,
  messageContent: String
});

const Message = mongoose.model("Message", messagesSchema);

const linksSchema = new mongoose.Schema({
  url: String,
  description: String
});

const Link = mongoose.model("Link", linksSchema);

// -------------------------------------------------
// Register
// -------------------------------------------------

app.get("/register", function(req, res) {
  res.render("register");
});

app.post("/register", function(req, res) {

  User.register({username: req.body.username}, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/");
      });
    }
  });

});

// -------------------------------------------------
// Login
// -------------------------------------------------

app.get("/login", function(req, res) {
  res.render("login");
});

app.post("/login", function(req, res) {

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/");
      });
    }
  });

});

// -------------------------------------------------
// Logout
// -------------------------------------------------

app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

// -------------------------------------------------
// Password pages
// -------------------------------------------------

app.get("/password", function(req, res) {
  res.render("password");
});

// -------------------------------------------------
// Home Index page
// -------------------------------------------------

app.get("/", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("index");
  } else {
    res.redirect("/login");
  }
});

// -------------------------------------------------
// Teams - General
// -------------------------------------------------

app.get("/teams", function(req, res) {

  if (req.isAuthenticated()) {

    Team.find(function(err, foundTeams) {
      res.render("teams", {teams: foundTeams});
    }).sort({name: 1});

  } else {
    res.redirect("/login");
  }

});

app.get("/teams/:teamId", function(req, res){

  if (req.isAuthenticated()) {

    const requestedTeamId = req.params.teamId;

    Team.findOne({_id: requestedTeamId}, function(err, team) {

      console.log("This team name: " + team.name);
      const requestedTeam = team.name;

      User.find({team: requestedTeam}, function(err, foundUsers) {

        console.log(requestedTeam);
        console.log(team._id);
        console.log(foundUsers);

        res.render("team", {
          teamName: team.name,
          teamId: team._id,
          users: foundUsers
        });
      });
    });

  } else {
    res.redirect("/login");
  }

});

// -------------------------------------------------
// Teams - Create
// -------------------------------------------------

app.post("/teams/create", function(req, res) {
  res.render("new-team", {teamExists: ""});
});

app.get("/new-team", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("new-team");
  } else {
    res.redirect("/login");
  }
});

app.post("/createTeam", function(req, res) {

  const teamToCreate = req.body.teamDescription;
  console.log("Team to create: " + teamToCreate);

  Team.countDocuments({name: teamToCreate}, function(err, count) {
    if (count > 0) {
      // document exists
      console.log("Team already exists");
      res.send({teamExists: "Team already exists!"});
    } else {
      //document does not exist
      const team = new Team({
        name: req.body.teamDescription
      });

      team.save(function(err) {
        if (!err) {
          res.redirect("/teams");
        }
      });
    }
  });

});

// -------------------------------------------------
// Teams - Edit
// -------------------------------------------------

app.post("/teams/:teamId/edit", function(req, res) {
  const teamId = req.params.teamId;
  const teamName = req.body.submitEdit;

  res.render("team-edit", {
    teamId: teamId,
    teamName: teamName
  });
});

app.get("/teams/:teamId/edit", function(req, res){

  if (req.isAuthenticated()) {

    const requestedTeamId = req.params.teamId;

    Team.findOne({_id: requestedTeamId}, function(err, team) {

      const requestedTeam = team.name;

      console.log(requestedTeam);

      res.render("team-edit", {
        teamName: team.name,
        teamId: team._id
      });
    });

  } else {
    res.redirect("/login");
  }

});

app.post("/teams/:teamId/updated", function(req, res) {
  const teamId = req.params.teamId;
  const newTeamName = req.body.newTeamName;

  Team.findOne({_id: teamId}, function(err, foundTeam) {
    Team.updateOne({_id: teamId}, {name: newTeamName}, function(err) {
      if (err) {
        log.error(err);
      } else {
        Team.findOne({_id:teamId}, function(err, foundNewTeam) {
          User.find({team: foundNewTeam.name}, function(err, foundUsers) {

            res.render("team", {
              teamName: foundNewTeam.name,
              teamId: foundNewTeam._id,
              users: foundUsers
            });
          });
        });
      }
    });
  });
});

// -------------------------------------------------
// Teams - Delete
// -------------------------------------------------

app.post("/teams/:teamId/delete", function(req, res) {
  const teamId = req.params.teamId;
  const teamName = req.body.submitDelete;

  res.render("team-delete", {
    teamId: teamId,
    teamName: teamName
  });
});

app.get("/teams/:teamId/delete", function(req, res) {

  if (req.isAuthenticated()) {

    const requestedTeamId = req.params.teamId;

    Team.findOne({_id: requestedTeamId}, function(err, team) {

      const requestedTeam = team.name;

      console.log(requestedTeam);

      res.render("team-delete", {
        teamName: team.name,
        teamId: team._id
      });
    });

  } else {
    res.redirect("/login");
  }

});

app.post("/teams/deleted", function(req, res) {
  const requestedTeamId = req.body.teamDelete;
  console.log("Team to delete: " + requestedTeamId);
  Team.deleteOne({_id: requestedTeamId}, function(err) {
    if (!err) {
      console.log("successfully deleted " + requestedTeamId);
    }
  });
  Team.find(function(err, foundTeams) {
    res.render("teams", {teams: foundTeams});
  }).sort({name: 1});
});

// -------------------------------------------------
// Users - General
// -------------------------------------------------

app.get("/users", function(req, res) {

  if (req.isAuthenticated()) {

    User.find(function(err, foundUsers) {
      res.render("users", {users: foundUsers});
    });

  } else {
    res.redirect("/login");
  }

});

app.get("/users/:userId", function(req, res){

  if (req.isAuthenticated()) {

    const requestedUserId = req.params.userId;

    User.findOne({_id: requestedUserId}, function(err, user) {

      res.render("user", {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        functionName: user.function,
        userName: user.username,
        userId: user._id,
        teamName: user.team
      });
    });

  } else {
    res.redirect("/login");
  }

});

// -------------------------------------------------
// Users - Search
// -------------------------------------------------

app.post("/users/search", function(req, res) {
  const requestedUser = req.body.userSearchValue;

  User.find({firstName: requestedUser}, function(err, foundUsers) {
    console.log(foundUsers);
  });

});

// -------------------------------------------------
// Users - Edit
// -------------------------------------------------

app.post("/users/:userId/edit", function(req, res) {
  const userId = req.params.userId;
  const userName = req.body.submitEdit;

  User.findOne({_id: userId}, function(err, user) {

    Team.find(function(err, foundTeams) {
      res.render("user-edit", {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        functionName: user.function,
        userName: user.username,
        teams: foundTeams
      });
    }).sort({name: 1});
  });
});

app.get("/users/:userId/edit", function(req, res){

  if (req.isAuthenticated()) {

    const requestedUserId = req.params.userIde;

    User.findOne({_id: requestedUserId}, function(err, user) {

      Team.find(function(err, foundTeams) {
        res.render("user-edit", {
          userId: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          functionName: user.function,
          userName: user.username,
          teams: foundTeams
        });
      }).sort({name: 1});
    });

  } else {
    res.redirect("/login");
  }

});

app.post("/users/:userId/updated", function(req, res) {
  const requestedUserId = req.params.userId;
  const newFirstName = req.body.newFirstName;
  const newLastName = req.body.newLastName;
  const newFunction = req.body.newFunction;
  const newTeam = req.body.newTeam;

  User.findOne({_id: requestedUserId}, function(err, foundUser) {
    User.updateOne({_id: requestedUserId}, {firstName: newFirstName, lastName: newLastName, function: newFunction, team: newTeam}, function(err) {
      if (err) {
        log.error(err);
      } else {
        User.findOne({username:foundUser.username}, function(err, foundNewUser) {

          Team.find(function(err, foundTeams) {
            res.render("user", {
              userId: foundNewUser._id,
              firstName: foundNewUser.firstName,
              lastName: foundNewUser.lastName,
              userName: foundNewUser.username,
              functionName: foundNewUser.function,
              userId: foundNewUser._id,
              teamName: foundNewUser.team,
              teams: foundTeams
            });
          });
        });
      }
    });
  });
});

// -------------------------------------------------
// Users - Delete
// -------------------------------------------------

app.post("/users/:userId/delete", function(req, res) {
  const userId = req.params.userId;
  const userName = req.body.submitDelete;

  User.findOne({_id: userId}, function(err, foundUser) {

    res.render("user-delete", {
      userId: foundUser._id,
      firstName: foundUser.firstName,
      lastName: foundUser.lastName,
      userName: foundUser.username
    });
  });
});

app.get("/users/<%=userId%>/delete", function(req, res) {

  if (req.isAuthenticated()) {

    const requestedUserId = req.params.userId;

    User.findOne({_id: requestedUserId}, function(err, user) {
      res.render("user-delete", {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.username,
        functionName: user.function,
        userId: user._id,
        teamName: user.team
      });
    });

  } else {
    res.redirect("/login");
  }

});

app.post("/users/deleted", function(req, res) {
  const requestedUser = req.body.userDelete;
  User.deleteOne({username: requestedUser}, function(err) {
    if (!err) {
      console.log("successfully deleted" + requestedUser);
      User.find(function(err, foundUsers) {
        res.render("users", {users: foundUsers});
      });
    }
  });
});

// -------------------------------------------------
// Messages - General
// -------------------------------------------------

app.get("/messages", function(req, res) {
  if (req.isAuthenticated()) {

    Message.find(function(err, foundMessages) {
      res.render("messages", {
        messages: foundMessages
      });
    });

  } else {
    res.redirect("/login");
  }

});

app.get("/messages/:messageId", function(req, res){

  if (req.isAuthenticated()) {

    const requestedMessageId = req.params.messageId;

    Message.findOne({_id: requestedMessageId}, function(err, message) {
      res.render("message", {
        messageTitle: message.messageTitle,
        messageContent: message.messageContent,
        messageId: message._id
      });
    });

  } else {
    res.redirect("/login");
  }

});

// -------------------------------------------------
// Messages - Create
// -------------------------------------------------

app.get("/new-message", function(req, res) {

  if (req.isAuthenticated()) {

    res.render("new-message");

  } else {
    res.redirect("/login");
  }

});

app.post("/post-message", function(req, res) {
  const postTitle = req.body.messageTitle;
  const postContent = req.body.messageContent;

  const message = new Message({
    messageTitle: postTitle,
    messageContent: postContent
  });

  message.save(function(err) {
    if (!err) {
      Message.find(function(err, foundMessages) {
        res.render("messages", {
          messages: foundMessages
        });
      });
    }
  });
});

// -------------------------------------------------
// Messages - Edit
// -------------------------------------------------

app.post("/messages/:messageId/edit", function(req, res) {

  const messageId = req.params.messageId;

  Message.findOne({_id: messageId}, function(err, foundMessage) {

    const messageTitle = foundMessage.messageTitle;
    const messageContent = foundMessage.messageContent;

    res.render("message-edit", {
      messageId: messageId,
      messageTitle: messageTitle,
      messageContent: messageContent
    });
  });
});

app.get("/messages/:messageId/edit", function(req, res) {

  if (req.isAuthenticated()) {

    const messageId = req.params.messageId;

    console.log("messageId = " + messageId);

    Message.findOne({_id: messageId}, function(err, foundMessage) {

      const messageTitle = foundMessage.messageTitle;
      const messageContent = foundMessage.messageContent;

      console.log(messageTitle + " " + messageContent);

      res.render("message-edit", {
        messageId: messageId,
        messageTitle: messageTitle,
        messageContent: messageContent
      });
    });

  } else {
    res.redirect("/login");
  }

});

app.post("/messages/:messageId/updated", function(req, res) {
  const messageId = req.params.messageId;
  const newMessageTitle = req.body.newMessageTitle;
  const newMessageContent = req.body.newMessageContent;

  Message.findOne({_id: messageId}, function(err, foundMessage) {
    Message.updateOne({_id: messageId}, {messageTitle: newMessageTitle, messageContent: newMessageContent}, function(err) {
      if (err) {
        console.log(err);
      } else {
        Message.findOne({_id: messageId}, function(err, foundNewMessage) {
          res.render("message", {
            messageId: foundNewMessage._id,
            messageTitle: foundNewMessage.messageTitle,
            messageContent: foundNewMessage.messageContent
          });
        });
      }
    });
  });
});

// -------------------------------------------------
// Messages - Delete
// -------------------------------------------------

app.post("/messages/:messageId/delete", function(req, res) {
  const requestedMessageId = req.params.messageId;

  console.log(requestedMessageId);

  Message.findOne({_id: requestedMessageId}, function(err, message) {
    res.render("message-delete", {
      messageId: message._id,
      messageTitle: message.messageTitle,
      messageContent:message.messageContent
    });
  });
});

app.get("/messages/<%=messageId%>/delete", function(req, res) {

  if (req.isAuthenticated()) {

    const requestedMessageId = req.params.messageId;
    console.log(requestedMessageId);

    Message.findOne({_id: requestedMessageId}, function(err, message) {
      res.render("message-delete", {
        messageTitle: message.messageTitle,
        messageId: message._id
      });
    });

  } else {
    res.redirect("/login");
  }

});

app.post("/messages/deleted", function(req, res) {
  const requestedMessageId = req.body.messageDelete;

  Message.deleteOne({_id: requestedMessageId}, function(err) {
    if (!err) {
      console.log("successfully deleted " + requestedMessageId);
      Message.find(function(err, foundMessages) {
        res.render("messages", {messages: foundMessages});
      });
    }
  });
});

// -------------------------------------------------
// Notes - General
// -------------------------------------------------

app.get("/notes", function(req, res) {

  if (req.isAuthenticated()) {

    Note.find().distinct("noteSubject", function(err, foundNoteSubjects) {

      const noteSubjects = foundNoteSubjects;

      Note.find(function(err, foundNotes) {
        res.render("notes", {
          noteSubjects: noteSubjects,
          notes: foundNotes
        });
      });
    });

  } else {
    res.redirect("/login");
  }

});

app.get("/notes/:noteId", function(req, res){

  if (req.isAuthenticated()) {

    const requestedNoteId = req.params.noteId;
    console.log(requestedNoteId);

    Note.findOne({_id: requestedNoteId}, function(err, note) {
      res.render("note", {
        noteTitle: note.noteTitle,
        noteContent: note.noteContent,
        noteSubject: note.noteSubject,
        noteId: note._id
      });
    });

  } else {
    res.redirect("/login");
  }

});

// -------------------------------------------------
// Notes - Create
// -------------------------------------------------

app.get("/new-note", function(req, res) {

  if (req.isAuthenticated()) {
    res.render("new-note");
  } else {
    res.redirect("/login");
  }
});

app.post("/post-note", function(req, res) {
  const noteSubject = req.body.noteSubject;
  const noteTitle = req.body.noteTitle;
  const noteContent = req.body.noteContent;

  const note = new Note({
    noteSubject: noteSubject,
    noteTitle: noteTitle,
    noteContent: noteContent
  });

  note.save(function(err) {
    if (!err) {
      Note.find(function(err, foundNotes) {
        res.redirect("notes");
      });
    }
  });
});

// -------------------------------------------------
// Notes - Edit
// -------------------------------------------------

app.post("/notes/:noteId/edit", function(req, res) {

  const noteId = req.params.noteId;

  Note.findOne({_id: noteId}, function(err, foundNote) {

    const noteTitle = foundNote.noteTitle;
    const noteContent = foundNote.noteContent;
    const noteSubject = foundNote.noteSubject;

    res.render("note-edit", {
      noteId: noteId,
      noteTitle: noteTitle,
      noteContent: noteContent,
      noteSubject: noteSubject
    });
  });
});

app.get("/notes/:noteId/edit", function(req, res) {

  if (req.isAuthenticated()) {

    const noteId = req.params.noteId;

    Note.findOne({_id: noteId}, function(err, foundNote) {

      const noteTitle = foundNote.noteTitle;
      const noteContent = foundNote.noteContent;
      const noteSubject = foundNote.noteSubject;

      res.render("note-edit", {
        noteId: noteId,
        noteTitle: noteTitle,
        noteContent: noteContent,
        noteSubject: noteSubject
      });
    });

  } else {
    res.redirect("/login");
  }

});

app.post("/notes/:noteId/updated", function(req, res) {
  const noteId = req.params.noteId;
  const newNoteTitle = req.body.newNoteTitle;
  const newNoteContent = req.body.newNoteContent;
  const newNoteSubject = req.body.newNoteSubject;

  Note.findOne({_id: noteId}, function(err, foundNote) {
    Note.updateOne({_id: noteId}, {noteTitle: newNoteTitle, noteContent: newNoteContent, noteSubject: newNoteSubject}, function(err) {
      if (err) {
        console.log(err);
      } else {
        Note.findOne({_id: noteId}, function(err, note) {
          res.render("note", {
            noteTitle: note.noteTitle,
            noteContent: note.noteContent,
            noteSubject: note.noteSubject,
            noteId: note._id
          });
        });
      }
    });
  });
});

// -------------------------------------------------
// Notes - Delete
// -------------------------------------------------

app.post("/notes/:noteId/delete", function(req, res) {
  const requestedNoteId = req.params.noteId;

  console.log(requestedNoteId);

  Note.findOne({_id: requestedNoteId}, function(err, note) {
    res.render("note-delete", {
      noteId: note._id,
      noteTitle: note.noteTitle,
      noteContent: note.noteContent,
      noteSubject: note.noteSubject
    });
  });
});

app.get("/notes/<%=noteId%>/delete", function(req, res) {

  if (req.isAuthenticated()) {

    const requestedNoteId = req.params.noteId;
    console.log(requestedNoteId);

    Note.findOne({_id: requestedNoteId}, function(err, note) {
      res.render("note-delete", {
        noteId: note._id,
        noteTitle: note.noteTitle,
        noteContent: note.noteContent,
        noteSubject: note.noteSubject
      });
    });

  } else {
    res.redirect("/login");
  }

});

app.post("/notes/deleted", function(req, res) {
  const requestedNoteId = req.body.noteDelete;

  Note.deleteOne({_id: requestedNoteId}, function(err) {
    if (!err) {
      Note.find(function(err, foundNotes) {
        res.render("notes", {notes: foundNotes});
      });
    }
  });
});

// -------------------------------------------------
// Links - General
// -------------------------------------------------

app.get("/links", function(req, res) {

  if (req.isAuthenticated()) {

    Link.find(function(err, foundLinks) {
      res.render("links", {links: foundLinks});
    }).sort({description: 1});

  } else {
    res.redirect("/login");
  }

});

app.listen(3000, function() {
  console.log("Server started successfully on port 3000");
});
