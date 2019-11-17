#!/bin/bash
#script for debugging mongodb problems
#gets a mongodb shell
exec docker run -it --network virusdata_dbnet --rm mongo mongo --host db -u root -p 'virusdata'