# oort -- like heroku for your personal server.
## this doesn't exist yet, i'm just planning it out, okay?!

# on the server
$ oort init
   - creating `~/.oort`
   - creating `repositories` folder
   - starting server

# on the client
in some sort of git repo
config:
{ "server": "bjb.io"
, "user": "brian"
}

$ oort launch
  - create a bare clone
  - push to server:$OORT_DIR/repositories
  - add remote `oort`
   
