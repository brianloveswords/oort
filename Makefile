.PHONY: clean

all: clean test

clean:
	git remote rm oort || echo 'skipping removal'
	rm -rf ~/tmp/repositories/oort.git
	rm -rf oort-bare-repository

test:
	./bin/oort launch